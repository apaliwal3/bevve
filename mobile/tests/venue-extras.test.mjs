import assert from 'node:assert/strict';
import { test } from 'node:test';

import { languageCatalog, mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import { mockVenueDetails, mockVenues } from '../src/fixtures/venues.ts';
import {
  initialVenueExtrasState,
  latestPriceObservation,
  normalizeLanguageCode,
  parseEuroPrice,
  publicVenueExtras,
  startingPriceCents,
  venueDrinkPrices,
  venueExtrasReducer,
  venuesWithLatestPrices,
} from '../src/features/contributions/venue-extras-state.ts';
import {
  emptyPriceDraft, priceDraftReducer, languageDraftReducer,
  emptyIncidentDraft, incidentDraftReducer, incidentSubmission,
} from '../src/features/contributions/extra-form-drafts.ts';
import { filterVenues } from '../src/features/explore/filter-venues.ts';
import { initialContributionsState, contributionsReducer, SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { venueRatingsReducer } from '../src/features/ratings/rating-state.ts';

const barA = mockVenues[0].id;
const barB = mockVenues[3].id;
const [beer, spritz, gin] = mockDrinkCatalog;
const now = Date.parse('2026-11-15T20:00:00Z');
const iso = (offset = 0) => new Date(now + offset).toISOString();
const id = (number) => `e98f6a21-fc7c-47dd-a82d-${number.toString(16).padStart(12, '0')}`;
const observation = (number, cents = 650, drinkId = beer.id, barId = barA, offset = 0) => ({
  id: id(number), bar_id: barId, drink_id: drinkId, price_cents: cents,
  currency: 'EUR', submitted_by: SESSION_USER_ID, observed_at: iso(offset),
});
const suggestion = (number, code = 'fr', barId = barA) => ({
  id: id(number), bar_id: barId, language_code: code, suggested_by: SESSION_USER_ID,
  status: 'pending', created_at: iso(),
});
const incident = (number, extra = {}) => ({
  id: id(number), bar_id: barA, reporter_id: SESSION_USER_ID,
  category: 'Theft', description: '  A private fictional test report.  ', occurred_at: null,
  status: 'pending', created_at: iso(), ...extra,
});
const observe = (state, row) => venueExtrasReducer(state, { type: 'observe-price', observation: row });
const suggest = (state, row, codes = ['it', 'en']) => venueExtrasReducer(state, { type: 'suggest-language', suggestion: row, associatedCodes: codes });
const report = (state, row) => venueExtrasReducer(state, { type: 'report-incident', report: row });

test('EUR input supports point/comma decimals and converts to exact integer cents', () => {
  for (const [input, cents] of [['6.50', 650], ['6,50', 650], ['6.5', 650], ['6,05', 605],
    ['6', 600], [' 6,50 ', 650], ['0.50', 50], ['100.00', 10000], ['1.01', 101]]) {
    assert.deepEqual(parseEuroPrice(input), { ok: true, value: cents }, input);
  }
});

test('EUR validation rejects empty, nonpositive, unrealistic, malformed and overprecise prices', () => {
  for (const input of ['', ' ', '0', '0.00', '0,49', '-6.50', '+6', '100.01', '1000',
    '6.501', '6,555', '1,000.00', '1.000,00', '6.', '6,', '6,5.0', '.50', '1e1', '€6', 'Infinity', '999999999999999999999']) {
    assert.equal(parseEuroPrice(input).ok, false, input);
  }
});

test('price corrections append observations, preserve timestamps/history, and replace only the latest visible price', () => {
  const previous = Object.freeze({ ...initialVenueExtrasState, priceObservations: Object.freeze([]) });
  const first = observe(previous, observation(1, 500, beer.id, barA, -1000));
  const edited = observe(first, observation(2, 650));
  assert.equal(previous.priceObservations.length, 0);
  assert.equal(first.priceObservations.length, 1);
  assert.equal(edited.priceObservations.length, 2);
  assert.equal(edited.priceObservations[0].observed_at, iso(-1000));
  assert.equal(latestPriceObservation(edited.priceObservations, barA, beer.id).price_cents, 650);
  const prices = venueDrinkPrices(edited.priceObservations, barA, mockVenueDetails[barA].drinks);
  assert.equal(prices[0].priceCents, 650);
  assert.equal(prices[0].observedAt, iso());
  assert.equal(prices[0].source, 'session');
  assert.equal(prices[1].priceCents, 700);
  assert.equal(prices[1].source, 'demo');
  assert.equal(startingPriceCents(prices), 650);
  assert.equal(observe(edited, observation(2, 650)), edited);
});

test('latest price is scoped by UUID and drink, with the backend timestamp/ID tie-break', () => {
  const rows = [observation(2, 700), observation(1, 600), observation(3, 100, spritz.id),
    observation(4, 200, beer.id, barB, 1000), observation(5, 300, beer.id, barA, -1000)];
  assert.equal(latestPriceObservation(rows, barA.toUpperCase(), beer.id).price_cents, 700);
  assert.equal(latestPriceObservation([...rows].reverse(), barA, beer.id).price_cents, 700);
  assert.equal(latestPriceObservation(rows, barB, beer.id).price_cents, 200);
  assert.equal(latestPriceObservation(rows, barA, gin.id), null);
  assert.equal(latestPriceObservation([{ ...rows[0], currency: 'USD' }], barA, beer.id), null);
});

test('catalog serving is structured and never stored as a free-text price column', () => {
  const before = JSON.stringify(mockDrinkCatalog);
  const state = observe(initialVenueExtrasState, { ...observation(1), serving: 'untrusted free text', serving_ml: 999 });
  assert.deepEqual(Object.keys(state.priceObservations[0]).sort(),
    ['id', 'bar_id', 'drink_id', 'price_cents', 'currency', 'submitted_by', 'observed_at'].sort());
  const row = venueDrinkPrices(state.priceObservations, barB)[0];
  assert.equal(row, undefined);
  const price = venueDrinkPrices(state.priceObservations, barA)[0];
  assert.equal(price.serving, `${beer.category} · ${beer.serving_ml} ml`);
  assert.equal(JSON.stringify(mockDrinkCatalog), before);
  assert.ok(mockDrinkCatalog.every((drink) => Number.isInteger(drink.serving_ml) && drink.serving_ml > 0));
});

test('price reducer rejects invalid contracts before state changes', () => {
  for (const extra of [{ price_cents: 0 }, { price_cents: 49 }, { price_cents: 10001 }, { price_cents: 6.5 },
    { bar_id: '1' }, { submitted_by: 'me' }, { drink_id: id(123) }, { currency: 'USD' }, { observed_at: 'invalid' }]) {
    assert.equal(observe(initialVenueExtrasState, { ...observation(1), ...extra }), initialVenueExtrasState);
  }
});

test('new venues gain a starting price; corrections update Explore Cheap filtering without changing ratings', () => {
  const before = JSON.stringify(mockVenues);
  let state = observe(initialVenueExtrasState, observation(1, 450, beer.id, barB));
  let venues = venuesWithLatestPrices(mockVenues, state.priceObservations, mockVenueDetails);
  assert.equal(venues[3].startingPriceCents, 450);
  assert.ok(filterVenues(venues, '', 'Cheap').some((venue) => venue.id === barB));
  state = observe(state, observation(2, 750, beer.id, barB, 1000));
  venues = venuesWithLatestPrices(mockVenues, state.priceObservations, mockVenueDetails);
  assert.equal(venues[3].startingPriceCents, 750);
  assert.ok(!filterVenues(venues, '', 'Cheap').some((venue) => venue.id === barB));
  assert.equal(venues[0], mockVenues[0]);
  assert.equal(venues[3].communityRating, mockVenues[3].communityRating);
  assert.equal(JSON.stringify(mockVenues), before);
  assert.equal(startingPriceCents([]), null);
  const multiple = [...state.priceObservations, observation(3, 600, spritz.id, barB, 2000)];
  assert.equal(startingPriceCents(venueDrinkPrices(multiple, barB)), 600);
});

test('editing and cancelling a price draft leaves saved prices and other open drafts untouched', () => {
  const state = observe(initialVenueExtrasState, observation(1));
  const before = JSON.stringify(state);
  let draft = priceDraftReducer(emptyPriceDraft, { type: 'select', drinkId: beer.id, savedCents: 650 });
  assert.equal(draft.euros, '6.50');
  draft = priceDraftReducer(draft, { type: 'price', euros: '9,00' });
  const otherDraft = { ...emptyIncidentDraft, category: 'Other', description: 'Still editing this form' };
  draft = priceDraftReducer(draft, { type: 'cancel' });
  assert.deepEqual(draft, emptyPriceDraft);
  assert.equal(JSON.stringify(state), before);
  assert.equal(otherDraft.description, 'Still editing this form');
  draft = priceDraftReducer(draft, { type: 'select', drinkId: beer.id, savedCents: 650 });
  assert.equal(draft.euros, '6.50');
  assert.equal(priceDraftReducer(draft, { type: 'select', drinkId: gin.id, savedCents: null }).euros, '');
});

test('language suggestions normalize codes, reject duplicates and associated languages, and remain pending', () => {
  assert.equal(normalizeLanguageCode(' EN '), 'en');
  assert.equal(normalizeLanguageCode('French'), null);
  const state = suggest(initialVenueExtrasState, suggestion(1, ' FR '));
  assert.equal(state.languageSuggestions.length, 1);
  assert.equal(state.languageSuggestions[0].language_code, 'fr');
  assert.equal(state.languageSuggestions[0].status, 'pending');
  assert.equal(suggest(state, suggestion(2, 'fr')), state);
  assert.equal(suggest(state, suggestion(3, 'en')), state);
  assert.equal(suggest(state, suggestion(4, 'IT')), state);
  assert.equal(suggest(state, suggestion(5, 'invalid')), state);
  assert.equal(suggest(state, { ...suggestion(6), status: 'confirmed' }), state);
  const other = suggest(state, suggestion(7, 'fr', barB), []);
  assert.equal(other.languageSuggestions.length, 2);
});

test('pending languages stay separate from associated venue languages and leave demo fixtures unchanged', () => {
  const before = JSON.stringify(mockVenueDetails);
  const state = suggest(initialVenueExtrasState, suggestion(1));
  const publicData = publicVenueExtras(state, barA, mockVenueDetails[barA]);
  assert.deepEqual(publicData.languages.map((row) => row.code), ['it', 'en']);
  assert.deepEqual(publicData.pendingLanguages.map((row) => row.language_code), ['fr']);
  assert.equal(publicVenueExtras(state, barB, mockVenueDetails[barB]).pendingLanguages.length, 0);
  assert.equal(JSON.stringify(mockVenueDetails), before);
  assert.ok(languageCatalog.some((language) => language.code === 'en'));
});

test('Cancel resets only the unsaved language selection, retaining saved pending suggestions', () => {
  const state = suggest(initialVenueExtrasState, suggestion(1));
  const selected = languageDraftReducer(null, { type: 'select', code: 'pt' });
  assert.equal(languageDraftReducer(selected, { type: 'reset' }), null);
  assert.equal(state.languageSuggestions.length, 1);
  assert.equal(state.languageSuggestions[0].language_code, 'fr');
});

test('incident validation requires a category and nonblank description within the backend length limit', () => {
  assert.equal(incidentSubmission(emptyIncidentDraft, now).ok, false);
  assert.equal(incidentSubmission({ ...emptyIncidentDraft, category: 'Other', description: '  ' }, now).ok, false);
  assert.equal(incidentSubmission({ ...emptyIncidentDraft, category: 'Other', description: 'x'.repeat(4001) }, now).ok, false);
  assert.equal(incidentSubmission({ ...emptyIncidentDraft, category: 'Unknown', description: 'Test' }, now).ok, false);
  assert.deepEqual(incidentSubmission({ category: 'Harassment', description: '  Example  ', date: '' }, now), {
    ok: true, value: { category: 'Harassment', description: 'Example', occurred_at: null },
  });
});

test('optional incident dates validate real calendar dates, including leap years and local today', () => {
  const base = { category: 'Other', description: 'Fictional test' };
  for (const date of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '0000-01-01',
    '2030-11-16', '15/11/2026', '2026-1-01', 'tomorrow']) {
    assert.equal(incidentSubmission({ ...base, date }, now).ok, false, date);
  }
  assert.equal(incidentSubmission({ ...base, date: '2024-02-29' }, now).ok, true);
  const localToday = new Date(2026, 10, 15, 0, 5).getTime();
  const result = incidentSubmission({ ...base, date: '2026-11-15' }, localToday);
  assert.equal(result.ok, true);
  assert.equal(result.value.occurred_at, new Date(2026, 10, 15).toISOString());
});

test('private incidents save trimmed pending reports with optional dates, without publishing allegations or a score', () => {
  const publicBefore = publicVenueExtras(initialVenueExtrasState, barA, mockVenueDetails[barA]);
  const fixtureBefore = JSON.stringify(mockVenueDetails);
  const first = report(initialVenueExtrasState, incident(1));
  const next = report(first, incident(2, { category: 'Other', occurred_at: iso(-86_400_000) }));
  assert.equal(first.privateIncidentReports.length, 1);
  assert.equal(next.privateIncidentReports.length, 2);
  assert.equal(next.privateIncidentReports[0].description, 'A private fictional test report.');
  assert.equal(next.privateIncidentReports[0].status, 'pending');
  assert.equal(next.privateIncidentReports[1].occurred_at, iso(-86_400_000));
  assert.deepEqual(publicVenueExtras(next, barA, mockVenueDetails[barA]), publicBefore);
  assert.ok(!JSON.stringify(publicBefore).includes('private fictional'));
  assert.ok(!('safetyScore' in publicBefore));
  assert.ok(!('privateIncidentReports' in publicBefore));
  assert.equal(JSON.stringify(mockVenueDetails), fixtureBefore);
  const demoWithPublicNote = { ...mockVenueDetails[barA], demoSafetyNotes: ['DEMO DATA · Fictional example for this test only.'] };
  assert.deepEqual(publicVenueExtras(next, barA, demoWithPublicNote).demoSafetyNotes, demoWithPublicNote.demoSafetyNotes);
  assert.equal(report(next, incident(2)), next);
});

test('incident state rejects future dates, invalid identifiers, categories, empty descriptions, or public status', () => {
  for (const extra of [{ bar_id: '1' }, { reporter_id: 'me' }, { category: 'Unknown' }, { description: ' ' },
    { description: 'x'.repeat(4001) }, { occurred_at: 'invalid' }, { occurred_at: iso(1) },
    { status: 'approved' }, { created_at: 'invalid' }]) {
    assert.equal(report(initialVenueExtrasState, incident(1, extra)), initialVenueExtrasState);
  }
});

test('incident editing and Cancel discard only the current private draft, never previously saved reports', () => {
  const saved = report(initialVenueExtrasState, incident(1));
  const before = JSON.stringify(saved);
  let draft = incidentDraftReducer(emptyIncidentDraft, { type: 'category', category: 'Violence' });
  draft = incidentDraftReducer(draft, { type: 'description', description: 'A draft, never submitted' });
  draft = incidentDraftReducer(draft, { type: 'date', date: '2026-11-14' });
  draft = incidentDraftReducer(draft, { type: 'description', description: 'Edited unsaved draft' });
  assert.equal(incidentSubmission(draft, now).ok, true);
  draft = incidentDraftReducer(draft, { type: 'reset' });
  assert.deepEqual(draft, emptyIncidentDraft);
  assert.equal(JSON.stringify(saved), before);
});

test('prices, languages and incidents remain independent from each other and overall/crowd/bathroom state', () => {
  const ratings = venueRatingsReducer({}, { venueId: barA, rating: 4 });
  const contributions = contributionsReducer(initialContributionsState, { type: 'submit-crowd', report: {
    id: id(99), bar_id: barA, user_id: SESSION_USER_ID, level: 3, created_at: iso(),
  } });
  const before = JSON.stringify({ ratings, contributions });
  const priced = observe(initialVenueExtrasState, observation(1));
  const languages = suggest(priced, suggestion(2));
  const incidents = report(languages, incident(3));
  assert.equal(languages.priceObservations, priced.priceObservations);
  assert.equal(incidents.priceObservations, priced.priceObservations);
  assert.equal(incidents.languageSuggestions, languages.languageSuggestions);
  assert.equal(JSON.stringify({ ratings, contributions }), before);
});
