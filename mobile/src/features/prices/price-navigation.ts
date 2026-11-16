import type { CatalogDrink } from '../../fixtures/contribution-catalog.ts';
import type { Venue } from '../../types/venue.ts';

export type PriceRouteParams = {
  drinkId?: string | string[];
  sourceBarId?: string | string[];
};

export function resolvePriceNavigation(params: PriceRouteParams, catalog: readonly CatalogDrink[], venues: readonly Venue[], preferredDrinkId: string | null) {
  const requested = params.drinkId === undefined ? preferredDrinkId ?? catalog[0]?.id : params.drinkId;
  const drink = typeof requested === 'string'
    ? catalog.find((item) => item.id === requested.toLowerCase()) ?? null
    : null;
  const sourceId = params.sourceBarId;
  const sourceVenue = typeof sourceId === 'string'
    ? venues.find((venue) => venue.id === sourceId.toLowerCase()) ?? null
    : null;
  return { drink, sourceVenue };
}

export function priceComparisonHref(drinkId: string | null, sourceBarId?: string) {
  return {
    pathname: '/prices' as const,
    params: { ...(drinkId ? { drinkId } : {}), ...(sourceBarId ? { sourceBarId } : {}) },
  };
}

export function venueFromPricesHref(barId: string, drinkId: string, sourceBarId?: string) {
  return {
    pathname: '/bars/[barId]' as const,
    params: { barId, returnTo: 'prices', drinkId, ...(sourceBarId ? { sourceBarId } : {}) },
  };
}

// Only known in-app destinations are used when a direct link has no stack to pop.
export function priceOriginHref(sourceVenue: Venue | null) {
  return sourceVenue
    ? { pathname: '/bars/[barId]' as const, params: { barId: sourceVenue.id } }
    : { pathname: '/explore' as const };
}
