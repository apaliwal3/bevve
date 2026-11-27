// Portable database DTOs shared by the backend and mobile adapters. No native
// modules or service credentials belong in this module.
export type ImpressionValue = 'liked' | 'fine' | 'disliked';
export type SavedComparisonRow = {
  id: string; user_id: string; winner_bar_id: string; loser_bar_id: string; created_at: string;
};
export type SavedImpressionRow = {
  user_id: string; bar_id: string; impression: ImpressionValue;
  eligible_for_community: boolean; created_at: string; updated_at: string;
};
export type CatalogDrinkRow = { id: string; name: string; category: string; serving_ml: number };
export type CatalogVenueRow = {
  id: string; name: string; address: string; latitude: number; longitude: number;
  is_demo: boolean; area: string | null; city: string | null; vibe: string | null;
  image_url: string | null; opening_hours_label: string | null; is_popular: boolean;
  crowd: { score: number | null; report_count: number; newest_report_at: string | null; classification: 'quiet' | 'moderate' | 'busy' | null };
  bathrooms: { review_count: number; cleanliness: number | null; accessibility: number | null; wait_time: number | null; accessibility_count: number; wait_time_count: number };
  opinions: { available: boolean; liked_count: number; fine_count: number; disliked_count: number; total_opinions: number; liked_percentage: number | null };
  languages: { code: string }[];
  drinks: (CatalogDrinkRow & { price_cents: number; currency: 'EUR'; observed_at: string })[];
};

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown): value is number => finite(value) && Number.isSafeInteger(value) && value >= 0;
const time = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
const score = (value: unknown) => value === null || (finite(value) && value >= 1 && value <= 5);
const nullableText = (value: unknown) => value === null || typeof value === 'string';

export function decodeSavedComparison(value: unknown, userId: string): SavedComparisonRow {
  if (!record(value) || !uuid(value.id) || !uuid(value.user_id) || value.user_id !== userId ||
    !uuid(value.winner_bar_id) || !uuid(value.loser_bar_id) || value.winner_bar_id === value.loser_bar_id ||
    !time(value.created_at)) throw new Error('Invalid comparison response');
  return { id: value.id, user_id: value.user_id, winner_bar_id: value.winner_bar_id,
    loser_bar_id: value.loser_bar_id, created_at: new Date(value.created_at).toISOString() };
}

export function decodeDrink(value: unknown): CatalogDrinkRow {
  if (!record(value) || !uuid(value.id) || typeof value.name !== 'string' || typeof value.category !== 'string' ||
    !count(value.serving_ml) || value.serving_ml === 0) throw new Error('Invalid drink catalog response');
  return { id: value.id, name: value.name, category: value.category, serving_ml: value.serving_ml };
}

export function decodeSavedImpression(value: unknown, userId: string): SavedImpressionRow {
  if (!record(value) || !uuid(value.user_id) || value.user_id !== userId || !uuid(value.bar_id) ||
    !['liked','fine','disliked'].includes(String(value.impression)) || typeof value.eligible_for_community !== 'boolean' ||
    !time(value.created_at) || !time(value.updated_at)) throw new Error('Invalid impression response');
  return { user_id: value.user_id, bar_id: value.bar_id, impression: value.impression as ImpressionValue,
    eligible_for_community: value.eligible_for_community, created_at: value.created_at, updated_at: value.updated_at };
}

export function decodeCatalogVenue(value: unknown): CatalogVenueRow {
  if (!record(value) || !uuid(value.id) || typeof value.name !== 'string' || typeof value.address !== 'string' ||
    !finite(value.latitude) || Math.abs(value.latitude) > 90 || !finite(value.longitude) || Math.abs(value.longitude) > 180 ||
    typeof value.is_demo !== 'boolean' || typeof value.is_popular !== 'boolean' ||
    !['area','city','vibe','image_url','opening_hours_label'].every(key => nullableText(value[key]))) throw new Error('Invalid venue response');
  const c = value.crowd, b = value.bathrooms, o = value.opinions;
  if (!record(c) || !score(c.score) || !count(c.report_count) || !(c.newest_report_at === null || time(c.newest_report_at)) ||
    !(c.classification === null || ['quiet','moderate','busy'].includes(String(c.classification))) ||
    !record(b) || !count(b.review_count) || !['cleanliness','accessibility','wait_time'].every(key => score(b[key])) ||
    !count(b.accessibility_count) || !count(b.wait_time_count) || !record(o) || typeof o.available !== 'boolean' ||
    !count(o.liked_count) || !count(o.fine_count) || !count(o.disliked_count) || !count(o.total_opinions) ||
    o.liked_count + o.fine_count + o.disliked_count !== o.total_opinions ||
    !(o.liked_percentage === null || (finite(o.liked_percentage) && o.liked_percentage >= 0 && o.liked_percentage <= 100)) ||
    (value.is_demo && o.available) || !Array.isArray(value.languages) ||
    !value.languages.every(item => record(item) && typeof item.code === 'string') || !Array.isArray(value.drinks)) throw new Error('Invalid venue summary response');
  value.drinks.forEach(item => {
    decodeDrink(item);
    if (!record(item) || !count(item.price_cents) || item.currency !== 'EUR' || !time(item.observed_at)) throw new Error('Invalid venue price response');
  });
  return value as CatalogVenueRow;
}
