import type { CatalogVenueRow, SavedImpressionRow } from '../../../../shared/venue-contracts.ts';
import type { Venue, VenueDetails } from '../../types/venue.ts';
import type { CommunityOpinionView } from '../impressions/community-opinion-presentation.ts';
import { saveVenueImpression, type Impression, type VenueImpressionsState } from '../impressions/impression-state.ts';
import { languageName } from '../../fixtures/contribution-catalog.ts';
import type { CrowdSummary } from '../contributions/contribution-state.ts';
import type { VenueDrinkPrice } from '../contributions/venue-extras-state.ts';

export type AccountVenueData = {
  isDemo: boolean; community: CommunityOpinionView; ownImpression: Impression | null;
  crowd: CrowdSummary; bathrooms: VenueDetails['bathrooms']; drinks: VenueDrinkPrice[];
  startingPriceCents: number | null;
};

export function catalogReadData(row: CatalogVenueRow, own?: SavedImpressionRow): AccountVenueData {
  return {
    isDemo: row.is_demo, community: catalogOpinion(row), ownImpression: own?.impression ?? null,
    crowd: row.crowd, bathrooms: catalogDetails(row).bathrooms,
    startingPriceCents: catalogVenue(row).startingPriceCents,
    drinks: row.drinks.map(drink => ({ id: drink.id, name: drink.name, serving: `${drink.serving_ml} ml`,
      priceCents: drink.price_cents, currency: drink.currency, observedAt: drink.observed_at, source: 'backend' })),
  };
}

export function catalogVenue(row: CatalogVenueRow): Venue {
  return {
    id: row.id, name: row.name, area: row.area?.trim() || 'Neighborhood unavailable',
    vibe: row.vibe?.trim() || 'Venue details unavailable', image: row.image_url ? { uri: row.image_url } : null,
    distanceMeters: null, distanceLabel: null, isPopular: row.is_popular,
    crowd: null, startingPriceCents: row.drinks.length ? Math.min(...row.drinks.map(drink => drink.price_cents)) : null,
    bathroomCleanliness: row.bathrooms.cleanliness,
  };
}

export function catalogDetails(row: CatalogVenueRow): VenueDetails {
  const b = row.bathrooms;
  return {
    city: row.city?.trim() || 'City unavailable', address: row.address, openingHoursLabel: row.opening_hours_label,
    crowd: { score: null, reportCount: 0, newestReportAgeMinutes: null },
    drinks: row.drinks.map(drink => ({ id: drink.id, name: drink.name, serving: `${drink.serving_ml} ml`, priceCents: drink.price_cents, currency: 'EUR' })),
    languages: row.languages.map(language => ({ code: language.code, name: languageName(language.code) })),
    bathrooms: b.review_count ? { reviewCount: b.review_count,
      cleanliness: { average: b.cleanliness, count: b.review_count },
      accessibility: { average: b.accessibility, count: b.accessibility_count },
      waitTime: { average: b.wait_time, count: b.wait_time_count } } : null,
    demoSafetyNotes: [],
  };
}

export function catalogOpinion(row: CatalogVenueRow): CommunityOpinionView {
  const opinion = row.opinions;
  if (!opinion.available) return { status: 'unavailable' };
  if (opinion.total_opinions === 0 || opinion.liked_percentage === null) return { status: 'empty', count: 0 };
  return { status: 'ready', count: opinion.total_opinions, percentage: Math.round(opinion.liked_percentage) };
}

export function savedImpressions(rows: Readonly<Record<string, SavedImpressionRow>>, venues: readonly CatalogVenueRow[]): VenueImpressionsState {
  return Object.values(rows).reduce<VenueImpressionsState>((state, row) => saveVenueImpression(state, {
    user_id: row.user_id, bar_id: row.bar_id, impression: row.impression, updated_at: row.updated_at,
    source: row.eligible_for_community && venues.some(venue => venue.id === row.bar_id && !venue.is_demo) ? 'community' : 'demo',
  }), {});
}
