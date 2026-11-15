import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import { mockVenueDetails, mockVenues } from '../src/fixtures/venues.ts';
import { initialVenueExtrasState, venueExtrasReducer } from '../src/features/contributions/venue-extras-state.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import {
  adaptRpcPriceComparison, comparisonRequest, formatEuroCents, mockPriceComparison,
} from '../src/features/prices/price-comparison.ts';
import {
  priceComparisonHref, priceOriginHref, resolvePriceNavigation, venueFromPricesHref,
} from '../src/features/prices/price-navigation.ts';

const [beer, spritz, gin] = mockDrinkCatalog;
const [luna, basso, notte, violet] = mockVenues;
const now = Date.parse('2026-11-15T20:00:00Z');
const id = (number) => `e98f6a21-fc7c-47dd-a82d-${number.toString(16).padStart(12, '0')}`;
const observation = (number, barId = luna.id, cents = 650, drinkId = beer.id, offset = 0) => ({
  id: id(number), bar_id: barId, drink_id: drinkId, price_cents: cents, currency: 'EUR',
  submitted_by: SESSION_USER_ID, observed_at: new Date(now + offset).toISOString(),
});
const compare = (drink = beer, observations = [], venues = mockVenues, details = mockVenueDetails, catalog = mockDrinkCatalog) =>
  mockPriceComparison(drink, catalog, venues, details, observations);
const observe = (state, row) => venueExtrasReducer(state, { type: 'observe-price', observation: row });

test('demo prices are sorted cheapest first and missing prices never become zero-priced offers', () => {
  const result = compare();
  assert.deepEqual(result.rows.map((row) => [row.venue.id, row.priceCents]), [[notte.id, 400], [luna.id, 500], [basso.id, 600]]);
  assert.deepEqual(result.missingVenues.map((venue) => venue.id), [violet.id]);
  assert.ok(result.rows.every((row) => row.drinkId === beer.id && row.servingMl === 400 && row.currency === 'EUR'));
});

test('snapshot observation dates stay unknown instead of being fabricated', () => {
  const result = compare();
  assert.ok(result.rows.every((row) => row.observedAt === null && row.source === 'demo'));
});

test('a newly submitted price immediately replaces the demo value and moves the venue in the sort order', () => {
  const state = observe(initialVenueExtrasState, observation(1, luna.id, 350));
  const result = compare(beer, state.priceObservations);
  assert.equal(result.rows[0].venue.id, luna.id);
  assert.equal(result.rows[0].priceCents, 350);
  assert.equal(result.rows[0].observedAt, new Date(now).toISOString());
  assert.equal(result.rows[0].source, 'session');
  assert.equal(result.rows.length, 3);
});

test('price edits use the latest observation, not the cheapest historical observation, and keep history intact', () => {
  const first = observe(initialVenueExtrasState, observation(1, luna.id, 300));
  const edited = observe(first, observation(2, luna.id, 750, beer.id, 1000));
  const result = compare(beer, edited.priceObservations);
  assert.equal(result.rows.at(-1).venue.id, luna.id);
  assert.equal(result.rows.at(-1).priceCents, 750);
  assert.equal(first.priceObservations.length, 1);
  assert.equal(edited.priceObservations.length, 2);
  assert.equal(edited.priceObservations[0].price_cents, 300);
});

test('latest same-time observations follow the backend UUID tie-break regardless of history order', () => {
  const rows = [observation(2, luna.id, 850), observation(1, luna.id, 250)];
  assert.equal(compare(beer, rows).rows.at(-1).priceCents, 850);
  assert.deepEqual(compare(beer, rows), compare(beer, [...rows].reverse()));
});

test('a venue with no previous prices gains a matching offer, without inventing prices for other drinks', () => {
  const state = observe(initialVenueExtrasState, observation(1, violet.id, 250));
  const result = compare(beer, state.priceObservations);
  assert.equal(result.rows[0].venue.id, violet.id);
  assert.equal(result.missingVenues.length, 0);
  assert.equal(compare(spritz, state.priceObservations).missingVenues[0].id, violet.id);
});

test('empty and single-price results are supported without assuming a minimum number of offers', () => {
  assert.deepEqual(compare(beer, [], [], {}), { rows: [], missingVenues: [] });
  assert.deepEqual(compare(beer, [], mockVenues, {}), { rows: [], missingVenues: mockVenues });
  assert.deepEqual(compare(null), { rows: [], missingVenues: [] });
  assert.deepEqual(compare({ ...beer, id: id(99) }), { rows: [], missingVenues: [] });
  const result = compare(beer, [observation(1)], mockVenues, {});
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].priceCents, 650);
  assert.equal(result.missingVenues.length, 3);
});

test('equal prices have a stable venue-name/UUID order, never a personal Elo order', () => {
  const observations = [observation(1, luna.id, 500), observation(2, basso.id, 500), observation(3, notte.id, 500)];
  assert.deepEqual(compare(beer, observations).rows.map((row) => row.venue.id), [basso.id, luna.id, notte.id]);
  const sameNames = mockVenues.map((venue) => ({ ...venue, name: 'Same name' }));
  assert.deepEqual(compare(beer, observations, [...sameNames].reverse()).rows.map((row) => row.venue.id), [luna.id, basso.id, notte.id]);
});

test('same-name drinks with different serving UUIDs remain separate comparisons', () => {
  const smallBeer = { ...beer, id: id(104), serving_ml: 330 };
  const catalog = [...mockDrinkCatalog, smallBeer];
  const observations = [observation(1, violet.id, 100, smallBeer.id)];
  const largeResult = compare(beer, observations, mockVenues, mockVenueDetails, catalog);
  assert.ok(!largeResult.rows.some((row) => row.venue.id === violet.id));
  assert.ok(largeResult.rows.every((row) => row.servingMl === 400));
  const smallResult = compare(smallBeer, observations, mockVenues, mockVenueDetails, catalog);
  assert.deepEqual(smallResult.rows.map((row) => [row.venue.id, row.servingMl, row.priceCents]), [[violet.id, 330, 100]]);
  assert.equal(smallResult.missingVenues.length, 3);
  assert.deepEqual(compare({ ...beer, serving_ml: 330 }), { rows: [], missingVenues: [] });
});

test('different drinks, unknown venues, invalid prices, and other currencies cannot enter a comparison', () => {
  const rows = [observation(1, luna.id, 200, spritz.id), observation(2, id(200), 100),
    { ...observation(3, violet.id, 100), currency: 'USD' }];
  assert.deepEqual(compare(beer, rows), compare());
  for (const price_cents of [0, -1, 6.5, NaN, Infinity]) {
    assert.equal(compare(beer, [{ ...observation(1, violet.id), price_cents }], mockVenues, {}).rows.length, 0);
  }
});

test('comparison is read-only and leaves frozen observations, catalog, fixtures and histories unchanged', () => {
  const observations = Object.freeze([Object.freeze(observation(1))]);
  const catalog = Object.freeze(mockDrinkCatalog.map((drink) => Object.freeze({ ...drink })));
  const venues = Object.freeze(mockVenues.map((venue) => Object.freeze({ ...venue })));
  const before = JSON.stringify({ observations, catalog, venues, details: mockVenueDetails });
  compare(beer, observations, venues, mockVenueDetails, catalog);
  compare(gin, observations, venues, mockVenueDetails, catalog);
  assert.equal(JSON.stringify({ observations, catalog, venues, details: mockVenueDetails }), before);
});

test('RPC adapter uses the exact request identity and backend field names, with no serving-text column', () => {
  const request = comparisonRequest(spritz, mockVenues);
  assert.deepEqual(request, { p_drink_id: spritz.id, p_bar_ids: mockVenues.map((venue) => venue.id), p_currency: 'EUR' });
  const result = adaptRpcPriceComparison(request, [
    { bar_id: basso.id, price_cents: 800, currency: 'EUR', observed_at: new Date(now).toISOString() },
    { bar_id: luna.id, price_cents: 700, currency: 'EUR', observed_at: new Date(now - 1000).toISOString() },
  ], mockDrinkCatalog, mockVenues);
  assert.deepEqual(result.rows.map((row) => [row.venue.id, row.drinkId, row.servingMl]), [[luna.id, spritz.id, 250], [basso.id, spritz.id, 250]]);
  assert.ok(result.rows.every((row) => row.source === 'rpc'));
  assert.equal(result.rows[0].priceCents, 700);
});

test('RPC adapter scopes requested venues, validates data, and handles empty responses', () => {
  const request = comparisonRequest(beer, [luna, violet]);
  const row = { bar_id: luna.id, price_cents: 500, currency: 'EUR', observed_at: new Date(now).toISOString() };
  assert.deepEqual(adaptRpcPriceComparison(request, [], mockDrinkCatalog, mockVenues), { rows: [], missingVenues: [luna, violet] });
  for (const extra of [{ price_cents: 0 }, { price_cents: -5 }, { currency: 'USD' }, { observed_at: 'invalid' }, { observed_at: null }, { bar_id: basso.id }]) {
    assert.equal(adaptRpcPriceComparison(request, [{ ...row, ...extra }], mockDrinkCatalog, mockVenues).rows.length, 0);
  }
  assert.equal(adaptRpcPriceComparison({ ...request, p_drink_id: id(999) }, [row], mockDrinkCatalog, mockVenues).rows.length, 0);
  assert.equal(formatEuroCents(650), '€6.50');
});

test('Explore entry uses the remembered drink and has an Explore return destination', () => {
  const href = priceComparisonHref(gin.id);
  assert.equal(href.pathname, '/prices');
  const result = resolvePriceNavigation(href.params, mockDrinkCatalog, mockVenues, beer.id);
  assert.equal(result.drink.id, gin.id);
  assert.equal(result.sourceVenue, null);
  assert.deepEqual(priceOriginHref(result.sourceVenue), { pathname: '/explore' });
  assert.equal(resolvePriceNavigation({}, mockDrinkCatalog, mockVenues, spritz.id).drink.id, spritz.id);
  assert.equal(resolvePriceNavigation({}, mockDrinkCatalog, mockVenues, null).drink.id, beer.id);
});

test('Bar Details entry and result links preserve selected drink and original source venue independently of the opened bar', () => {
  const entry = priceComparisonHref(beer.id, luna.id);
  const chosen = { ...entry.params, drinkId: spritz.id };
  const link = venueFromPricesHref(basso.id, spritz.id, chosen.sourceBarId);
  assert.equal(link.params.barId, basso.id);
  assert.equal(link.params.returnTo, 'prices');
  const saved = resolvePriceNavigation(link.params, mockDrinkCatalog, mockVenues, gin.id);
  assert.equal(saved.drink.id, spritz.id);
  assert.equal(saved.sourceVenue.id, luna.id);
  assert.deepEqual(priceComparisonHref(saved.drink.id, saved.sourceVenue.id).params, chosen);
  assert.deepEqual(priceOriginHref(saved.sourceVenue), { pathname: '/bars/[barId]', params: { barId: luna.id } });
});

test('invalid or repeated route parameters cannot invent a drink, venue, or external return destination', () => {
  for (const drinkId of ['1', 'Beer', id(999), [beer.id, gin.id]]) {
    assert.equal(resolvePriceNavigation({ drinkId }, mockDrinkCatalog, mockVenues, beer.id).drink, null);
  }
  for (const sourceBarId of ['1', 'https://example.com', id(999), [luna.id, basso.id]]) {
    assert.equal(resolvePriceNavigation({ sourceBarId }, mockDrinkCatalog, mockVenues, beer.id).sourceVenue, null);
  }
  assert.equal(resolvePriceNavigation({ drinkId: beer.id.toUpperCase(), sourceBarId: luna.id.toUpperCase() }, mockDrinkCatalog, mockVenues, null).drink.id, beer.id);
  assert.equal(resolvePriceNavigation({}, [], [], null).drink, null);
});
