export const sentimentValues = ['liked', 'fine', 'disliked'] as const;
export type Sentiment = (typeof sentimentValues)[number];
export type SentimentSource = 'demo' | 'community';

// One current answer per user/venue. Provenance is explicit: a demo answer can
// establish personal experience, but must never become a real community vote.
export type VenueSentiment = Readonly<{
  user_id: string;
  bar_id: string;
  sentiment: Sentiment;
  source: SentimentSource;
  updated_at: string;
}>;

type UserSentiments = Readonly<Partial<Record<string, VenueSentiment>>>;
export type VenueSentimentsState = Readonly<Partial<Record<string, UserSentiments>>>;
export const initialVenueSentimentsState: VenueSentimentsState = {};

export function normalizeSentimentUuid(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

// Also validates future adapter snapshots without importing fixture, provider,
// star-rating, comparison or backend state. Unknown fields are not retained.
export function normalizeVenueSentiment(value: unknown): VenueSentiment | null {
  if (value === null || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const userId = normalizeSentimentUuid(row.user_id);
  const barId = normalizeSentimentUuid(row.bar_id);
  if (!userId || !barId || !sentimentValues.some((sentiment) => sentiment === row.sentiment) ||
    (row.source !== 'demo' && row.source !== 'community') || typeof row.updated_at !== 'string') return null;
  const time = Date.parse(row.updated_at);
  if (!Number.isFinite(time)) return null;
  return {
    user_id: userId, bar_id: barId, sentiment: row.sentiment as Sentiment,
    source: row.source, updated_at: new Date(time).toISOString(),
  };
}

// Callers supply the time and provenance; this operation performs no IO and
// reads no clock. Equal-time edits follow call order; stale snapshots are ignored.
export function saveVenueSentiment(state: VenueSentimentsState, input: VenueSentiment): VenueSentimentsState {
  const record = normalizeVenueSentiment(input);
  if (!record) throw new Error('A valid sentiment, user UUID, venue UUID, source and timestamp are required.');
  const user = state[record.user_id] ?? {};
  const previous = user[record.bar_id];
  if (previous && (previous.updated_at > record.updated_at ||
    (previous.updated_at === record.updated_at && previous.sentiment === record.sentiment && previous.source === record.source))) return state;
  return { ...state, [record.user_id]: { ...user, [record.bar_id]: record } };
}

export function getUserVenueSentiment(state: VenueSentimentsState, userId: string, barId: string): VenueSentiment | null {
  const user = normalizeSentimentUuid(userId);
  const venue = normalizeSentimentUuid(barId);
  return user && venue ? state[user]?.[venue] ?? null : null;
}

// All three saved sentiments establish experience. Merely opening a venue does
// not. Excluding the current venue supports future anchored comparison flows.
export function experiencedVenueIds(state: VenueSentimentsState, userId: string, excludeBarId?: string): string[] {
  const user = normalizeSentimentUuid(userId);
  if (!user) return [];
  const excluded = normalizeSentimentUuid(excludeBarId);
  return Object.entries(state[user] ?? {})
    .filter(([id, record]) => record !== undefined && id !== excluded)
    .map(([id]) => id).sort();
}
