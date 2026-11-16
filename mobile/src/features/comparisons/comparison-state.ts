declare const uuidBrand: unique symbol;
export type UUID = string & { readonly [uuidBrand]: true };

export function parseUuid(value: string): UUID | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() as UUID : null;
}

// Mirrors bar_comparisons. Session IDs/timestamps will be server-generated later.
export type PersonalComparison = {
  id: UUID;
  user_id: UUID;
  winner_bar_id: UUID;
  loser_bar_id: UUID;
  created_at: string;
};

export type InternalPersonalRanking = { bar_id: UUID; score: number; comparisons: number };
export const INITIAL_ELO = 1000;
export const ELO_K = 32;

type RankingComparison = Pick<PersonalComparison, 'id' | 'winner_bar_id' | 'loser_bar_id' | 'created_at'>;
const chronological = (left: RankingComparison, right: RankingComparison) =>
  left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id);

// Mobile-safe implementation of barhop-backend/src/logic/eloRanking.ts.
// Scores are never rounded, stored as review ratings, or exposed by the UI hook.
export function calculatePersonalRankings(comparisons: readonly RankingComparison[]): InternalPersonalRanking[] {
  const scores = new Map<UUID, number>();
  const counts = new Map<UUID, number>();
  for (const match of [...comparisons].sort(chronological)) {
    const winnerId = match.winner_bar_id;
    const loserId = match.loser_bar_id;
    if (winnerId === loserId) throw new Error('Choose two different bars');
    const winner = scores.get(winnerId) ?? INITIAL_ELO;
    const loser = scores.get(loserId) ?? INITIAL_ELO;
    const change = ELO_K * (1 - 1 / (1 + 10 ** ((loser - winner) / 400)));
    scores.set(winnerId, winner + change);
    scores.set(loserId, loser - change);
    counts.set(winnerId, (counts.get(winnerId) ?? 0) + 1);
    counts.set(loserId, (counts.get(loserId) ?? 0) + 1);
  }
  return [...scores].map(([bar_id, score]) => ({ bar_id, score, comparisons: counts.get(bar_id) ?? 0 }))
    .sort((left, right) => right.score - left.score || left.bar_id.localeCompare(right.bar_id));
}

export type VenuePair = readonly [UUID, UUID];
export function pairKey(pair: VenuePair): string {
  return [...pair].sort().join('|');
}

// All valid venues are eligible, independently of community ratings or contributions.
// Least-presented unordered pairs give every pairing a turn; card order alternates.
export function selectNextPair(venueIds: readonly UUID[], presentations: Readonly<Record<string, number>>, current: VenuePair | null, round: number): VenuePair | null {
  const ids = [...new Set(venueIds)].sort();
  const pairs: VenuePair[] = [];
  for (let first = 0; first < ids.length; first++) {
    for (let second = first + 1; second < ids.length; second++) pairs.push([ids[first], ids[second]]);
  }
  if (pairs.length === 0) return null;
  const alternatives = pairs.filter((pair) => current === null || pairKey(pair) !== pairKey(current));
  const candidates = alternatives.length > 0 ? alternatives : pairs;
  candidates.sort((left, right) => (presentations[pairKey(left)] ?? 0) - (presentations[pairKey(right)] ?? 0) || pairKey(left).localeCompare(pairKey(right)));
  const [first, second] = candidates[0];
  return round % 2 === 0 ? [first, second] : [second, first];
}

type ComparisonFeedback = { kind: 'vote'; winnerId: UUID } | { kind: 'skip' } | null;
export type PersonalComparisonState = {
  userId: UUID;
  venueIds: readonly UUID[];
  history: readonly PersonalComparison[];
  rankings: readonly InternalPersonalRanking[];
  presentations: Readonly<Record<string, number>>;
  pair: VenuePair | null;
  round: number;
  phase: 'ready' | 'feedback';
  feedback: ComparisonFeedback;
};

export function createPersonalComparisonState(userId: string, venueIds: readonly string[]): PersonalComparisonState {
  const user = parseUuid(userId);
  if (!user) throw new Error('A session user UUID is required.');
  const ids = [...new Set(venueIds.flatMap((id) => { const uuid = parseUuid(id); return uuid ? [uuid] : []; }))];
  const pair = selectNextPair(ids, {}, null, 0);
  return {
    userId: user, venueIds: ids, history: [], rankings: [], presentations: pair ? { [pairKey(pair)]: 1 } : {},
    pair, round: 0, phase: 'ready', feedback: null,
  };
}

export type PersonalComparisonAction =
  | { type: 'vote'; round: number; comparison: PersonalComparison }
  | { type: 'skip'; round: number }
  | { type: 'advance'; round: number };

function advancePair(state: PersonalComparisonState): PersonalComparisonState {
  const round = state.round + 1;
  const pair = selectNextPair(state.venueIds, state.presentations, state.pair, round);
  return {
    ...state, round, pair, phase: 'ready',
    presentations: pair ? { ...state.presentations, [pairKey(pair)]: (state.presentations[pairKey(pair)] ?? 0) + 1 } : state.presentations,
  };
}

export function personalComparisonReducer(state: PersonalComparisonState, action: PersonalComparisonAction): PersonalComparisonState {
  // Round tokens reject stale events even after a new pair appears. Phase guards also
  // reject rapid taps on either venue or Skip during the saved-choice feedback.
  if (action.round !== state.round || state.pair === null) return state;
  if (action.type === 'advance') return state.phase === 'feedback' ? advancePair(state) : state;
  if (state.phase !== 'ready') return state;
  if (action.type === 'skip') return advancePair({ ...state, feedback: { kind: 'skip' } });
  const row = action.comparison;
  const winner = parseUuid(row.winner_bar_id);
  const loser = parseUuid(row.loser_bar_id);
  const id = parseUuid(row.id);
  const user = parseUuid(row.user_id);
  const time = Date.parse(row.created_at);
  if (!id || user !== state.userId || !winner || !loser || winner === loser ||
    !state.pair.includes(winner) || !state.pair.includes(loser) || !Number.isFinite(time) ||
    state.history.some((comparison) => comparison.id === id)) return state;
  const comparison: PersonalComparison = {
    id, user_id: user, winner_bar_id: winner, loser_bar_id: loser, created_at: new Date(time).toISOString(),
  };
  const history = [...state.history, comparison].sort(chronological);
  return {
    ...state, history, rankings: calculatePersonalRankings(history), phase: 'feedback', feedback: { kind: 'vote', winnerId: winner },
  };
}
