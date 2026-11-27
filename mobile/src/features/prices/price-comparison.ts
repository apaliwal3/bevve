import type { CatalogDrink } from '../../fixtures/contribution-catalog.ts';
import type { Venue, VenueDetails } from '../../types/venue.ts';
import { latestPriceObservation, type SessionPriceObservation } from '../contributions/venue-extras-state.ts';

// Exact compare_drink_prices RPC parameter/row names. No network client is used here.
// The drink UUID identifies its catalog serving_ml; serving text is never a join key.
export type CompareDrinkPricesRequest = {
  p_drink_id: string;
  p_bar_ids: string[];
  p_currency: 'EUR';
};

export type CompareDrinkPricesRpcRow = {
  bar_id: string;
  price_cents: number;
  currency: string;
  observed_at: string;
};

type ComparisonQuote = Omit<CompareDrinkPricesRpcRow, 'observed_at'> & {
  observed_at: string | null;
  source: 'demo' | 'session' | 'rpc';
};

export type PriceComparisonRow = {
  venue: Venue;
  drinkId: string;
  servingMl: number;
  priceCents: number;
  currency: 'EUR';
  observedAt: string | null;
  source: ComparisonQuote['source'];
};

export type PriceComparison = {
  rows: PriceComparisonRow[];
  missingVenues: Venue[];
};

export function comparisonRequest(drink: CatalogDrink, venues: readonly Venue[]): CompareDrinkPricesRequest {
  return {
    p_drink_id: drink.id.toLowerCase(),
    p_bar_ids: [...new Set(venues.map((venue) => venue.id.toLowerCase()))],
    p_currency: 'EUR',
  };
}

function adaptQuotes(drink: CatalogDrink, venues: readonly Venue[], quotes: readonly ComparisonQuote[]): PriceComparison {
  const latest = new Map<string, ComparisonQuote>();
  for (const quote of quotes) {
    if (quote.currency !== 'EUR' || !Number.isSafeInteger(quote.price_cents) || quote.price_cents < 0) continue;
    if (quote.price_cents === 0 && quote.source !== 'rpc') continue;
    if (quote.observed_at === null ? quote.source !== 'demo' : !Number.isFinite(Date.parse(quote.observed_at))) continue;
    const id = quote.bar_id.toLowerCase();
    const previous = latest.get(id);
    if (!previous || Date.parse(quote.observed_at ?? '') > Date.parse(previous.observed_at ?? '') ||
      (previous.observed_at === null && quote.observed_at !== null)) latest.set(id, quote);
  }
  const rows: PriceComparisonRow[] = [];
  const missingVenues: Venue[] = [];
  for (const venue of venues) {
    const quote = latest.get(venue.id.toLowerCase());
    if (!quote) {
      missingVenues.push(venue);
      continue;
    }
    rows.push({
      venue, drinkId: drink.id, servingMl: drink.serving_ml, priceCents: quote.price_cents,
      currency: 'EUR', observedAt: quote.observed_at, source: quote.source,
    });
  }
  rows.sort((left, right) => left.priceCents - right.priceCents ||
    left.venue.name.localeCompare(right.venue.name, 'en') || left.venue.id.localeCompare(right.venue.id));
  return { rows, missingVenues };
}

export function mockPriceComparison(
  selection: CatalogDrink | null,
  catalog: readonly CatalogDrink[],
  venues: readonly Venue[],
  details: Partial<Record<string, VenueDetails>>,
  observations: readonly SessionPriceObservation[],
): PriceComparison {
  const drink = catalog.find((item) => item.id === selection?.id && item.serving_ml === selection.serving_ml);
  if (!drink) return { rows: [], missingVenues: [] };
  const quotes: ComparisonQuote[] = [];
  for (const venue of venues) {
    const session = latestPriceObservation(observations, venue.id, drink.id);
    if (session) {
      quotes.push({ ...session, source: 'session' });
      continue;
    }
    const demo = details[venue.id.toLowerCase()]?.drinks.find((row) => row.id === drink.id);
    if (demo && demo.priceCents !== null) {
      // Snapshot dates were never provided. Keep that absence visible, without inventing one.
      quotes.push({ bar_id: venue.id, price_cents: demo.priceCents, currency: demo.currency, observed_at: null, source: 'demo' });
    }
  }
  return adaptQuotes(drink, venues, quotes);
}

// Future RPC responses can use this adapter with the request that produced them.
// Identity/serving come from that exact catalog UUID, never from the currently visible tab.
export function adaptRpcPriceComparison(
  request: CompareDrinkPricesRequest,
  rows: readonly CompareDrinkPricesRpcRow[],
  catalog: readonly CatalogDrink[],
  venues: readonly Venue[],
): PriceComparison {
  const drink = catalog.find((item) => item.id === request.p_drink_id.toLowerCase());
  if (!drink || request.p_currency !== 'EUR') return { rows: [], missingVenues: [] };
  const requestedIds = new Set(request.p_bar_ids.map((id) => id.toLowerCase()));
  return adaptQuotes(drink, venues.filter((venue) => requestedIds.has(venue.id.toLowerCase())),
    rows.map((row) => ({ ...row, source: 'rpc' })));
}

export function formatEuroCents(cents: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
