import {
  experiencedVenueIds, getUserVenueImpression, normalizeVenueImpression,
  type VenueImpressionsState,
} from '../impressions/impression-state.ts';
import {
  parseUuid, personalComparisonReducer,
  type PersonalComparison, type PersonalComparisonState, type UUID, type VenuePair,
} from './comparison-state.ts';

// Prototype journey policy only. This does not alter the Elo algorithm.
export const PROTOTYPE_MAX_VENUE_COMPARISONS = 3;

const uuid = (value: unknown) => typeof value === 'string' ? parseUuid(value) : null;

function savedVenueIds(impressions: VenueImpressionsState, userId: UUID): UUID[] {
  return experiencedVenueIds(impressions, userId).flatMap((value) => {
    const id = uuid(value);
    const record = normalizeVenueImpression(getUserVenueImpression(impressions, userId, value));
    return id && record?.user_id === userId && record.bar_id === id ? [id] : [];
  });
}

type OpponentSelection = {
  userId: string;
  currentVenueId: string;
  impressions: VenueImpressionsState;
  catalogVenueIds: readonly string[];
  history: readonly PersonalComparison[];
};

// Snapshot a bounded set: unplayed first, then oldest last match (timestamp/ID),
// then venue UUID. Only this user's saved experience and history are considered.
export function selectVenueComparisonOpponents(input: OpponentSelection): UUID[] {
  const user = uuid(input.userId);
  const current = uuid(input.currentVenueId);
  if (!user || !current) return [];
  const catalog = new Set(input.catalogVenueIds.flatMap((value) => { const id = uuid(value); return id ? [id] : []; }));
  const experienced = savedVenueIds(input.impressions, user);
  if (!catalog.has(current) || !experienced.includes(current)) return [];
  const eligible = new Set(experienced.filter((id) => id !== current && catalog.has(id)));
  const lastMatch = new Map<UUID, { time: number; id: UUID }>();
  for (const row of input.history) {
    if (!row || uuid(row.user_id) !== user) continue;
    const winner = uuid(row.winner_bar_id), loser = uuid(row.loser_bar_id), id = uuid(row.id);
    const time = typeof row.created_at === 'string' ? Date.parse(row.created_at) : NaN;
    if (!winner || !loser || !id || winner === loser || !Number.isFinite(time)) continue;
    const opponent = winner === current ? loser : loser === current ? winner : null;
    if (!opponent || !eligible.has(opponent)) continue;
    const previous = lastMatch.get(opponent);
    if (!previous || time > previous.time || (time === previous.time && id > previous.id)) lastMatch.set(opponent, { time, id });
  }
  return [...eligible].sort((left, right) => {
    const a = lastMatch.get(left), b = lastMatch.get(right);
    if (!a && b) return -1;
    if (a && !b) return 1;
    return (a && b ? a.time - b.time || a.id.localeCompare(b.id) : 0) || left.localeCompare(right);
  }).slice(0, PROTOTYPE_MAX_VENUE_COMPARISONS);
}

export type VenueComparisonFlow = {
  id: UUID;
  currentVenueId: UUID;
  opponentIds: readonly UUID[];
  round: number;
  phase: 'comparisons' | 'contributions';
  finishReason: 'no-opponents' | 'already-experienced' | 'completed' | 'skipped-remaining' | null;
};

export type VenueComparisonController = {
  // The supplied personal state is the sole comparison history, not a copy of
  // its events in a second flow ledger. Existing scheduling fields stay intact.
  comparisons: PersonalComparisonState;
  flow: VenueComparisonFlow | null;
  knownVenueIds: readonly UUID[];
  usedFlowIds: readonly UUID[];
};

// Initialize once with existing saved impressions, BEFORE saving a newly added
// venue. Existing/imported experience must not trigger automatic comparisons.
// Retain this controller across overlay mounts; do not recreate it on reopening.
export function createVenueComparisonController(
  comparisons: PersonalComparisonState,
  existingImpressions: VenueImpressionsState,
): VenueComparisonController {
  const user = uuid(comparisons.userId);
  if (!user) throw new Error('A comparison user UUID is required.');
  return {
    comparisons: user === comparisons.userId ? comparisons : { ...comparisons, userId: user },
    flow: null, knownVenueIds: savedVenueIds(existingImpressions, user), usedFlowIds: [],
  };
}

export type VenueComparisonToken = {
  flowId: string;
  userId: string;
  currentVenueId: string;
  opponentId: string;
  round: number;
};

type BeginVenueComparison = {
  type: 'begin';
  flowId: string;
  expectedFlowId: string | null;
  userId: string;
  currentVenueId: string;
  intent: 'after-impression' | 'compare-again';
  impressions: VenueImpressionsState;
  catalogVenueIds: readonly string[];
};

export type VenueComparisonAction = BeginVenueComparison
  | (VenueComparisonToken & { type: 'vote'; comparison: PersonalComparison })
  | (VenueComparisonToken & { type: 'skip-one' | 'skip-remaining' });

// Reading a prompt is side-effect free. Capture its token in callbacks so a
// queued tap cannot acquire a newer flow/round's authority when it is handled.
export function getVenueComparisonPrompt(state: VenueComparisonController): { pair: VenuePair; token: VenueComparisonToken } | null {
  const flow = state.flow;
  if (!flow || flow.phase !== 'comparisons') return null;
  const opponent = flow.opponentIds[flow.round];
  if (!opponent) return null;
  return {
    pair: flow.round % 2 === 0 ? [flow.currentVenueId, opponent] : [opponent, flow.currentVenueId],
    token: { flowId: flow.id, userId: state.comparisons.userId, currentVenueId: flow.currentVenueId, opponentId: opponent, round: flow.round },
  };
}

function consumePrompt(flow: VenueComparisonFlow, skipRemaining = false): VenueComparisonFlow {
  const round = skipRemaining ? flow.opponentIds.length : flow.round + 1;
  const finished = round >= flow.opponentIds.length;
  return {
    ...flow, round, phase: finished ? 'contributions' : 'comparisons',
    finishReason: skipRemaining ? 'skipped-remaining' : finished ? 'completed' : null,
  };
}

export function venueComparisonFlowReducer(state: VenueComparisonController, action: VenueComparisonAction): VenueComparisonController {
  if (action.type === 'begin') {
    const flowId = uuid(action.flowId), user = uuid(action.userId), current = uuid(action.currentVenueId);
    const expected = action.expectedFlowId === null ? null : uuid(action.expectedFlowId);
    if (!flowId || user !== state.comparisons.userId || !current || state.usedFlowIds.includes(flowId) ||
      (action.expectedFlowId !== null && !expected) || expected !== (state.flow?.id ?? null) ||
      (action.intent !== 'after-impression' && action.intent !== 'compare-again')) return state;
    const saved = savedVenueIds(action.impressions, user);
    if (!saved.includes(current) || !action.catalogVenueIds.some((value) => uuid(value) === current)) return state;
    const previouslyExperienced = state.knownVenueIds.includes(current);
    const opponents = action.intent === 'after-impression' && previouslyExperienced ? []
      : selectVenueComparisonOpponents({ ...action, history: state.comparisons.history });
    return {
      ...state,
      knownVenueIds: [...new Set([...state.knownVenueIds, ...saved])].sort(),
      usedFlowIds: [...state.usedFlowIds, flowId],
      flow: {
        id: flowId, currentVenueId: current, opponentIds: opponents, round: 0,
        phase: opponents.length ? 'comparisons' : 'contributions',
        finishReason: opponents.length ? null : action.intent === 'after-impression' && previouslyExperienced ? 'already-experienced' : 'no-opponents',
      },
    };
  }

  const prompt = getVenueComparisonPrompt(state);
  if (!prompt || !state.flow || uuid(action.flowId) !== state.flow.id || uuid(action.userId) !== state.comparisons.userId ||
    uuid(action.currentVenueId) !== state.flow.currentVenueId || uuid(action.opponentId) !== prompt.token.opponentId ||
    action.round !== state.flow.round) return state;
  if (action.type === 'skip-one' || action.type === 'skip-remaining') {
    return { ...state, flow: consumePrompt(state.flow, action.type === 'skip-remaining') };
  }
  if (action.type !== 'vote') return state;

  // Reuse ONLY the existing vote branch for event validation, UUID normalization,
  // deduplication, chronological insertion and exact Elo replay. No legacy pair
  // selection/advance action is invoked, and its scheduling state is preserved.
  const votingState: PersonalComparisonState = {
    ...state.comparisons, pair: prompt.pair, round: state.flow.round, phase: 'ready', feedback: null,
  };
  const voted = personalComparisonReducer(votingState, { type: 'vote', round: state.flow.round, comparison: action.comparison });
  if (voted === votingState) return state;
  return {
    ...state,
    comparisons: { ...state.comparisons, history: voted.history, rankings: voted.rankings },
    flow: consumePrompt(state.flow),
  };
}
