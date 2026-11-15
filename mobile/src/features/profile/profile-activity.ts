import type { CatalogDrink } from '../../fixtures/contribution-catalog.ts';
import type { Venue } from '../../types/venue.ts';
import { parseUuid, type UUID } from '../comparisons/comparison-state.ts';
import type { CrowdLevel, SessionBathroomReview, SessionCrowdReport } from '../contributions/contribution-state.ts';
import type { SessionPriceObservation } from '../contributions/venue-extras-state.ts';
import type { StarRating, VenueRatingsState } from '../ratings/rating-state.ts';

export type ProfileVenue = Pick<Venue, 'name' | 'area' | 'image'> & { id: UUID; available: boolean };
type ProfileSource = {
  ratings: Readonly<VenueRatingsState>;
  crowdReports: readonly SessionCrowdReport[];
  bathroomReviews: readonly SessionBathroomReview[];
  priceObservations: readonly SessionPriceObservation[];
};
export type ProfileRating = { venue: ProfileVenue; rating: StarRating };
export type ProfileCrowdReport = { id: string; venue: ProfileVenue; level: CrowdLevel; submittedAt: string };
export type ProfileBathroomReview = {
  id: string; venue: ProfileVenue; cleanliness: StarRating; accessibility: StarRating; waitTime: StarRating; updatedAt: string;
};
export type ProfilePriceObservation = {
  id: string; venue: ProfileVenue; drinkName: string; servingMl: number | null; priceCents: number; observedAt: string;
};

export function selectProfileContributions(source: ProfileSource, userId: string, venues: readonly Venue[], drinks: readonly CatalogDrink[]) {
  const owner = userId.toLowerCase();
  const venueById = new Map(venues.map((venue) => [venue.id.toLowerCase(), venue]));
  const venueInfo = (barId: string): ProfileVenue | null => {
    const id = parseUuid(barId);
    if (!id) return null;
    const venue = venueById.get(id);
    return { id, name: venue?.name ?? 'Venue unavailable', area: venue?.area ?? 'Neighborhood unavailable', image: venue?.image ?? null, available: venue !== undefined };
  };
  const ratings: ProfileRating[] = Object.entries(source.ratings).flatMap(([barId, rating]) => {
    const venue = venueInfo(barId);
    return venue && rating !== undefined ? [{ venue, rating }] : [];
  }).sort((left, right) => left.venue.name.localeCompare(right.venue.name) || left.venue.id.localeCompare(right.venue.id));
  const crowds: ProfileCrowdReport[] = source.crowdReports.flatMap((report) => {
    const venue = venueInfo(report.bar_id);
    return venue && report.user_id.toLowerCase() === owner ? [{ id: report.id, venue, level: report.level, submittedAt: report.created_at }] : [];
  }).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || right.id.localeCompare(left.id));

  // Reviews are editable per user/venue. This projection also tolerates duplicate
  // snapshots from a future adapter without inflating the count.
  const bathroomByVenue = new Map<string, SessionBathroomReview>();
  for (const review of source.bathroomReviews) {
    if (review.user_id.toLowerCase() !== owner) continue;
    const key = review.bar_id.toLowerCase();
    const previous = bathroomByVenue.get(key);
    if (!previous || review.updated_at > previous.updated_at || (review.updated_at === previous.updated_at && review.id > previous.id)) bathroomByVenue.set(key, review);
  }
  const bathrooms: ProfileBathroomReview[] = [...bathroomByVenue.values()].flatMap((review) => {
    const venue = venueInfo(review.bar_id);
    return venue ? [{ id: review.id, venue, cleanliness: review.cleanliness, accessibility: review.accessibility, waitTime: review.wait_time, updatedAt: review.updated_at }] : [];
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.id.localeCompare(left.id));
  const prices: ProfilePriceObservation[] = source.priceObservations.flatMap((observation) => {
    const venue = venueInfo(observation.bar_id);
    if (!venue || observation.submitted_by.toLowerCase() !== owner) return [];
    const drink = drinks.find((item) => item.id.toLowerCase() === observation.drink_id.toLowerCase());
    return [{
      id: observation.id, venue, drinkName: drink?.name ?? 'Drink unavailable', servingMl: drink?.serving_ml ?? null,
      priceCents: observation.price_cents, observedAt: observation.observed_at,
    }];
  }).sort((left, right) => right.observedAt.localeCompare(left.observedAt) || right.id.localeCompare(left.id));

  // No fixture baselines, page visits, language suggestions or private reports are inputs.
  return {
    ratings, crowds, bathrooms, prices,
    counts: { ratings: ratings.length, crowdReports: crowds.length, bathroomReviews: bathrooms.length, priceObservations: prices.length },
    updatesCount: crowds.length + bathrooms.length + prices.length,
  };
}
