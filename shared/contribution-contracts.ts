export type ContributionScore = 1 | 2 | 3 | 4 | 5;
export type SavedCrowdReport = { id: string; bar_id: string; user_id: string; level: ContributionScore; created_at: string };
export type SavedBathroomReview = { id: string; bar_id: string; user_id: string; cleanliness: ContributionScore;
  accessibility: ContributionScore | null; wait_time: ContributionScore | null; created_at: string; updated_at: string };
export type SavedDrinkPrice = { id: string; bar_id: string; drink_id: string; submitted_by: string;
  price_cents: number; currency: 'EUR'; observed_at: string };
export type ContributionInput =
  | { kind: 'crowd'; barId: string; level: ContributionScore }
  | { kind: 'bathroom'; barId: string; cleanliness: ContributionScore; accessibility: ContributionScore; wait_time: ContributionScore }
  | { kind: 'price'; barId: string; drinkId: string; priceCents: number };
export type ContributionRequest = { id: string; input: ContributionInput };
export type ContributionResult = { kind: 'crowd'; row: SavedCrowdReport }
  | { kind: 'bathroom'; row: SavedBathroomReview } | { kind: 'price'; row: SavedDrinkPrice };

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
export const contributionUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const time = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export const contributionScore = (value: unknown): value is ContributionScore => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
export function validContributionInput(input: ContributionInput) {
  if (!contributionUuid(input.barId)) return false;
  if (input.kind === 'crowd') return contributionScore(input.level);
  if (input.kind === 'bathroom') return [input.cleanliness,input.accessibility,input.wait_time].every(contributionScore);
  return input.kind === 'price' && contributionUuid(input.drinkId) && Number.isSafeInteger(input.priceCents) && input.priceCents >= 50 && input.priceCents <= 10000;
}
export function decodeCrowdReport(value: unknown, userId: string): SavedCrowdReport {
  if (!record(value) || !contributionUuid(value.id) || !contributionUuid(value.bar_id) || value.user_id !== userId ||
    !contributionScore(value.level) || !time(value.created_at)) throw new Error('Invalid crowd report response');
  return { id: value.id, bar_id: value.bar_id, user_id: userId, level: value.level, created_at: value.created_at };
}
export function decodeBathroomReview(value: unknown, userId: string): SavedBathroomReview {
  if (!record(value) || !contributionUuid(value.id) || !contributionUuid(value.bar_id) || value.user_id !== userId ||
    !contributionScore(value.cleanliness) || !(value.accessibility === null || contributionScore(value.accessibility)) ||
    !(value.wait_time === null || contributionScore(value.wait_time)) || !time(value.created_at) || !time(value.updated_at) ||
    Date.parse(value.updated_at) < Date.parse(value.created_at)) throw new Error('Invalid bathroom review response');
  return { id: value.id, bar_id: value.bar_id, user_id: userId, cleanliness: value.cleanliness,
    accessibility: value.accessibility, wait_time: value.wait_time, created_at: value.created_at, updated_at: value.updated_at };
}
export function decodeDrinkPrice(value: unknown, userId: string): SavedDrinkPrice {
  if (!record(value) || !contributionUuid(value.id) || !contributionUuid(value.bar_id) || !contributionUuid(value.drink_id) ||
    value.submitted_by !== userId || typeof value.price_cents !== 'number' || !Number.isSafeInteger(value.price_cents) ||
    value.price_cents < 0 || value.currency !== 'EUR' || !time(value.observed_at)) throw new Error('Invalid price observation response');
  return { id: value.id, bar_id: value.bar_id, drink_id: value.drink_id, submitted_by: userId,
    price_cents: value.price_cents, currency: 'EUR', observed_at: value.observed_at };
}
export function matchesContribution(result: ContributionResult, request: ContributionRequest) {
  const input = request.input;
  if (result.row.bar_id !== input.barId) return false;
  if (result.kind === 'crowd' && input.kind === 'crowd') return result.row.id === request.id && result.row.level === input.level;
  if (result.kind === 'price' && input.kind === 'price') return result.row.id === request.id && result.row.drink_id === input.drinkId && result.row.price_cents === input.priceCents;
  return result.kind === 'bathroom' && input.kind === 'bathroom' && result.row.cleanliness === input.cleanliness &&
    result.row.accessibility === input.accessibility && result.row.wait_time === input.wait_time;
}
