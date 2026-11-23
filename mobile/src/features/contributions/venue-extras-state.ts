import { languageCatalog, mockDrinkCatalog, type VenueLanguageCode } from '../../fixtures/contribution-catalog.ts';
import type { Venue, VenueDetails } from '../../types/venue.ts';
import { incidentCategories, type IncidentCategory } from '../../../../shared/safety-contracts.ts';
export { incidentCategories, type IncidentCategory } from '../../../../shared/safety-contracts.ts';

export const MIN_PRICE_CENTS = 50;
export const MAX_PRICE_CENTS = 10_000;
export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

// Parse decimal text as integers, avoiding binary floating-point rounding of euros.
export function parseEuroPrice(input: string): ValidationResult<number> {
  const text = input.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) {
    return { ok: false, error: 'Enter a EUR price with up to two decimals, e.g. 6.50 or 6,50.' };
  }
  const [whole, fraction = ''] = text.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!validPriceCents(cents)) return { ok: false, error: 'Use a price from €0.50 to €100 for this demo.' };
  return { ok: true, value: cents };
}

export function validPriceCents(cents: number): boolean {
  return Number.isSafeInteger(cents) && cents >= MIN_PRICE_CENTS && cents <= MAX_PRICE_CENTS;
}

// These observation fields mirror drink_prices. No free-text serving column is added.
export type SessionPriceObservation = {
  id: string;
  bar_id: string;
  drink_id: string;
  price_cents: number;
  currency: 'EUR';
  submitted_by: string;
  observed_at: string;
};

// The backend has no suggestion write contract yet. Pending suggestions are kept
// separate from its read-only bar_languages associations and from interface language.
export type SessionLanguageSuggestion = {
  id: string;
  bar_id: string;
  language_code: VenueLanguageCode;
  suggested_by: string;
  status: 'pending';
  created_at: string;
};

export type SessionPrivateIncident = {
  id: string;
  bar_id: string;
  reporter_id: string;
  category: IncidentCategory;
  description: string;
  occurred_at: string | null;
  status: 'pending';
  created_at: string;
};

export type VenueExtrasState = {
  priceObservations: readonly SessionPriceObservation[];
  languageSuggestions: readonly SessionLanguageSuggestion[];
  privateIncidentReports: readonly SessionPrivateIncident[];
};

export const initialVenueExtrasState: VenueExtrasState = {
  priceObservations: [], languageSuggestions: [], privateIncidentReports: [],
};

type VenueExtrasAction =
  | { type: 'observe-price'; observation: SessionPriceObservation }
  | { type: 'suggest-language'; suggestion: SessionLanguageSuggestion; associatedCodes: readonly string[] }
  | { type: 'report-incident'; report: SessionPrivateIncident };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validTime = (time: string) => Number.isFinite(Date.parse(time));

export function normalizeLanguageCode(code: string): VenueLanguageCode | null {
  const normalized = code.trim().toLowerCase();
  return languageCatalog.find((language) => language.code === normalized)?.code ?? null;
}

export function venueExtrasReducer(state: VenueExtrasState, action: VenueExtrasAction): VenueExtrasState {
  switch (action.type) {
    case 'observe-price': {
      const row = action.observation;
      if (![row.id, row.bar_id, row.drink_id, row.submitted_by].every((id) => uuid.test(id)) ||
        !validTime(row.observed_at) || !validPriceCents(row.price_cents) || row.currency !== 'EUR' ||
        !mockDrinkCatalog.some((drink) => drink.id === row.drink_id.toLowerCase()) ||
        state.priceObservations.some((observation) => observation.id === row.id.toLowerCase())) return state;
      // Explicit DTO construction keeps catalog/presentation fields out of observations.
      const observation: SessionPriceObservation = {
        id: row.id.toLowerCase(), bar_id: row.bar_id.toLowerCase(), drink_id: row.drink_id.toLowerCase(),
        price_cents: row.price_cents, currency: 'EUR', submitted_by: row.submitted_by.toLowerCase(), observed_at: row.observed_at,
      };
      return { ...state, priceObservations: [...state.priceObservations, observation] };
    }
    case 'suggest-language': {
      const row = action.suggestion;
      const code = normalizeLanguageCode(row.language_code);
      const barId = row.bar_id.toLowerCase();
      if (!code || ![row.id, row.bar_id, row.suggested_by].every((id) => uuid.test(id)) ||
        !validTime(row.created_at) || row.status !== 'pending' ||
        action.associatedCodes.some((associated) => associated.trim().toLowerCase() === code) ||
        state.languageSuggestions.some((suggestion) => suggestion.id === row.id.toLowerCase() ||
          (suggestion.bar_id === barId && suggestion.language_code === code))) return state;
      return { ...state, languageSuggestions: [...state.languageSuggestions, {
        id: row.id.toLowerCase(), bar_id: barId, language_code: code,
        suggested_by: row.suggested_by.toLowerCase(), status: 'pending', created_at: row.created_at,
      }] };
    }
    case 'report-incident': {
      const row = action.report;
      const description = row.description.trim();
      if (![row.id, row.bar_id, row.reporter_id].every((id) => uuid.test(id)) ||
        !incidentCategories.includes(row.category) || description.length < 1 || description.length > 4000 ||
        !validTime(row.created_at) || row.status !== 'pending' ||
        (row.occurred_at !== null && (!validTime(row.occurred_at) || Date.parse(row.occurred_at) > Date.parse(row.created_at))) ||
        state.privateIncidentReports.some((report) => report.id === row.id.toLowerCase())) return state;
      return { ...state, privateIncidentReports: [...state.privateIncidentReports, {
        id: row.id.toLowerCase(), bar_id: row.bar_id.toLowerCase(), reporter_id: row.reporter_id.toLowerCase(),
        category: row.category, description, occurred_at: row.occurred_at, status: 'pending', created_at: row.created_at,
      }] };
    }
  }
}

export function latestPriceObservation(rows: readonly SessionPriceObservation[], barId: string, drinkId: string) {
  return rows.reduce<SessionPriceObservation | null>((latest, row) => {
    if (row.bar_id !== barId.toLowerCase() || row.drink_id !== drinkId.toLowerCase() || row.currency !== 'EUR') return latest;
    const time = Date.parse(row.observed_at);
    const latestTime = latest ? Date.parse(latest.observed_at) : -Infinity;
    // Same deterministic timestamp/UUID tie-break as the backend comparison RPC.
    return time > latestTime || (time === latestTime && latest !== null && row.id > latest.id) ? row : latest;
  }, null);
}

export type VenueDrinkPrice = VenueDetails['drinks'][number] & { observedAt: string | null; source: 'demo' | 'session' | 'backend' };

export function venueDrinkPrices(rows: readonly SessionPriceObservation[], barId: string, demo: readonly VenueDetails['drinks'][number][] = []): VenueDrinkPrice[] {
  const result: VenueDrinkPrice[] = demo.map((drink) => ({ ...drink, observedAt: null, source: 'demo' }));
  for (const drink of mockDrinkCatalog) {
    const observation = latestPriceObservation(rows, barId, drink.id);
    if (!observation) continue;
    const index = result.findIndex((row) => row.id === drink.id);
    const row: VenueDrinkPrice = {
      id: drink.id, name: drink.name, serving: `${drink.category} · ${drink.serving_ml} ml`,
      priceCents: observation.price_cents, currency: observation.currency, observedAt: observation.observed_at, source: 'session',
    };
    if (index === -1) result.push(row);
    else result[index] = row;
  }
  return result;
}

export function startingPriceCents(prices: readonly VenueDrinkPrice[]): number | null {
  const available = prices.flatMap((row) => row.priceCents !== null && row.priceCents > 0 ? [row.priceCents] : []);
  return available.length > 0 ? Math.min(...available) : null;
}

export function venuesWithLatestPrices(venues: readonly Venue[], observations: readonly SessionPriceObservation[], demo: Partial<Record<string, VenueDetails>>): Venue[] {
  return venues.map((venue) => {
    const id = venue.id.toLowerCase();
    if (!observations.some((row) => row.bar_id === id)) return venue;
    const prices = venueDrinkPrices(observations, id, demo[id]?.drinks);
    return { ...venue, startingPriceCents: startingPriceCents(prices) };
  });
}

// Public selectors intentionally cannot publish or return private incident reports.
export function publicVenueExtras(state: VenueExtrasState, barId: string, demo?: VenueDetails) {
  const id = barId.toLowerCase();
  return {
    drinks: venueDrinkPrices(state.priceObservations, id, demo?.drinks),
    languages: demo?.languages ?? [],
    pendingLanguages: state.languageSuggestions.filter((suggestion) => suggestion.bar_id === id),
    demoSafetyNotes: demo?.demoSafetyNotes ?? [],
  };
}
