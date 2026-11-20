export const impressionValues = ['liked', 'fine', 'disliked'] as const;
export type Impression = (typeof impressionValues)[number];
export type ImpressionSource = 'demo' | 'community';

// One current answer per user/venue. Provenance is explicit: a demo answer can
// establish personal experience, but must never become a real community vote.
export type VenueImpression = Readonly<{
  user_id: string;
  bar_id: string;
  impression: Impression;
  source: ImpressionSource;
  updated_at: string;
}>;

type UserImpressions = Readonly<Partial<Record<string, VenueImpression>>>;
export type VenueImpressionsState = Readonly<Partial<Record<string, UserImpressions>>>;
export const initialVenueImpressionsState: VenueImpressionsState = {};

export function normalizeImpressionUuid(value: unknown): string | null {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

// Also validates future adapter snapshots without importing fixture, provider,
// star-rating, comparison or backend state. Unknown fields are not retained.
export function normalizeVenueImpression(value: unknown): VenueImpression | null {
  if (value === null || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const userId = normalizeImpressionUuid(row.user_id);
  const barId = normalizeImpressionUuid(row.bar_id);
  if (!userId || !barId || !impressionValues.some((impression) => impression === row.impression) ||
    (row.source !== 'demo' && row.source !== 'community') || typeof row.updated_at !== 'string') return null;
  const time = Date.parse(row.updated_at);
  if (!Number.isFinite(time)) return null;
  return {
    user_id: userId, bar_id: barId, impression: row.impression as Impression,
    source: row.source, updated_at: new Date(time).toISOString(),
  };
}

// Callers supply the time and provenance; this operation performs no IO and
// reads no clock. Equal-time edits follow call order; stale snapshots are ignored.
export function saveVenueImpression(state: VenueImpressionsState, input: VenueImpression): VenueImpressionsState {
  const record = normalizeVenueImpression(input);
  if (!record) throw new Error('A valid impression, user UUID, venue UUID, source and timestamp are required.');
  const user = state[record.user_id] ?? {};
  const previous = user[record.bar_id];
  if (previous && (previous.updated_at > record.updated_at ||
    (previous.updated_at === record.updated_at && previous.impression === record.impression && previous.source === record.source))) return state;
  return { ...state, [record.user_id]: { ...user, [record.bar_id]: record } };
}

export function getUserVenueImpression(state: VenueImpressionsState, userId: string, barId: string): VenueImpression | null {
  const user = normalizeImpressionUuid(userId);
  const venue = normalizeImpressionUuid(barId);
  return user && venue ? state[user]?.[venue] ?? null : null;
}

// All three saved impressions establish experience. Merely opening a venue does
// not. Excluding the current venue supports future anchored comparison flows.
export function experiencedVenueIds(state: VenueImpressionsState, userId: string, excludeBarId?: string): string[] {
  const user = normalizeImpressionUuid(userId);
  if (!user) return [];
  const excluded = normalizeImpressionUuid(excludeBarId);
  return Object.entries(state[user] ?? {})
    .filter(([id, record]) => record !== undefined && id !== excluded)
    .map(([id]) => id).sort();
}
