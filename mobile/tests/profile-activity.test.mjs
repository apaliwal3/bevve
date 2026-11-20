import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mockVenues, mockVenueDetails } from '../src/fixtures/venues.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { saveVenueImpression } from '../src/features/impressions/impression-state.ts';
import { contributionsReducer, initialContributionsState, SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { initialVenueExtrasState, venueExtrasReducer } from '../src/features/contributions/venue-extras-state.ts';
import { createPersonalComparisonState, personalComparisonReducer } from '../src/features/comparisons/comparison-state.ts';
import { selectPersonalRankings } from '../src/features/rankings/personal-rankings.ts';
import { navigateBackFromBarDetails, resolveBarDetailsBack, venueFromProfileHref } from '../src/features/venues/bar-details-navigation.ts';

const [barA, barB] = mockVenues.map((venue) => venue.id);
const beer = mockDrinkCatalog[0];
const otherUser = '97c0c196-e3f2-4d15-9c53-81757f652dd2';
const id = (number) => 'e98f6a21-fc7c-47dd-a82d-' + number.toString(16).padStart(12, '0');
const now = Date.parse('2026-11-15T20:00:00Z');
const iso = (offset = 0) => new Date(now + offset).toISOString();
const impression = (impression = 'liked', bar = barA, user = SESSION_USER_ID, offset = 0) => ({
  user_id: user, bar_id: bar, impression, source: 'demo', updated_at: iso(offset),
});
const saved = (...records) => records.reduce(saveVenueImpression, {});
const empty = () => ({ impressions: {}, crowdReports: [], bathroomReviews: [], priceObservations: [] });
const view = (source, venues = mockVenues, catalog = mockDrinkCatalog) => selectProfileContributions(source, SESSION_USER_ID, venues, catalog);
const crowd = (number, level = 4, user = SESSION_USER_ID, bar = barA, offset = number) => ({
  id: id(number), user_id: user, bar_id: bar, level, created_at: iso(offset),
});
const bathroom = (number, scores = [4, 3, 5], user = SESSION_USER_ID, bar = barA, offset = number) => ({
  id: id(number), user_id: user, bar_id: bar, cleanliness: scores[0], accessibility: scores[1], wait_time: scores[2],
  created_at: iso(offset), updated_at: iso(offset),
});
const price = (number, cents = 650, user = SESSION_USER_ID, bar = barA) => ({
  id: id(number), bar_id: bar, drink_id: beer.id, submitted_by: user, price_cents: cents,
  currency: 'EUR', observed_at: iso(number),
});

test('fresh Profile has zero activity, independent of fictional venue and bathroom baseline counts', () => {
  assert.ok(mockVenueDetails[barA].bathrooms.reviewCount > 0);
  assert.ok(mockVenues.every((venue) => !('communityRating' in venue)));
  assert.deepEqual(view(empty()), {
    impressions: [], crowds: [], bathrooms: [], prices: [],
    counts: { impressions: 0, crowdReports: 0, bathroomReviews: 0, priceObservations: 0 }, updatesCount: 0,
  });
});

test('editing an impression changes its displayed value without adding an activity count', () => {
  const first = saved(impression());
  const edited = saveVenueImpression(first, impression('disliked', barA.toUpperCase(), SESSION_USER_ID, 1));
  const result = view({ ...empty(), impressions: edited });
  assert.equal(result.counts.impressions, 1);
  assert.equal(result.impressions[0].impression, 'disliked');
  assert.equal(result.impressions[0].venue.id, barA);
  const another = saveVenueImpression(edited, impression('fine', barB));
  assert.equal(view({ ...empty(), impressions: another }).counts.impressions, 2);
  assert.equal(first[SESSION_USER_ID][barA].impression, 'liked');
});

test('bathroom edits retain one review and show current category values', () => {
  const first = contributionsReducer(initialContributionsState, { type: 'save-bathroom', review: bathroom(1) });
  const edited = contributionsReducer(first, { type: 'save-bathroom', review: bathroom(2, [2, 5, 1]) });
  const result = view({ ...empty(), bathroomReviews: edited.bathroomReviews });
  assert.equal(result.counts.bathroomReviews, 1);
  assert.equal(result.updatesCount, 1);
  assert.equal(result.bathrooms[0].id, id(1));
  assert.deepEqual([result.bathrooms[0].cleanliness, result.bathrooms[0].accessibility, result.bathrooms[0].waitTime], [2, 5, 1]);
  assert.equal(result.bathrooms[0].updatedAt, iso(2));
});

test('crowd submission history counts every own report, including reports older than the live window', () => {
  const old = crowd(1, 1, SESSION_USER_ID, barA, -60 * 60 * 1000);
  const first = contributionsReducer(initialContributionsState, { type: 'submit-crowd', report: old });
  const next = contributionsReducer(first, { type: 'submit-crowd', report: crowd(2, 5) });
  const result = view({ ...empty(), crowdReports: next.crowdReports });
  assert.equal(result.counts.crowdReports, 2);
  assert.deepEqual(result.crowds.map((row) => row.level), [5, 1]);
  assert.equal(result.crowds[1].submittedAt, old.created_at);
});

test('price corrections count as observations and retain structured serving information and prior submissions', () => {
  const first = venueExtrasReducer(initialVenueExtrasState, { type: 'observe-price', observation: price(1) });
  const next = venueExtrasReducer(first, { type: 'observe-price', observation: price(2, 750) });
  const result = view({ ...empty(), priceObservations: next.priceObservations });
  assert.equal(result.counts.priceObservations, 2);
  assert.deepEqual(result.prices.map((row) => row.priceCents), [750, 650]);
  assert.ok(result.prices.every((row) => row.drinkName === 'Beer' && row.servingMl === 400));
  assert.equal(first.priceObservations.length, 1);
  assert.equal(next.priceObservations.length, 2);
});

test('counts and lists include only the current demo contributor', () => {
  const source = {
    impressions: saved(impression('liked'), impression('fine', barA, otherUser)),
    crowdReports: [crowd(1), crowd(2, 5, otherUser)],
    bathroomReviews: [bathroom(3), bathroom(4, [1, 1, 1], otherUser)],
    priceObservations: [price(5), price(6, 100, otherUser)],
  };
  const result = view(source);
  assert.deepEqual(result.counts, { impressions: 1, crowdReports: 1, bathroomReviews: 1, priceObservations: 1 });
  assert.equal(result.impressions[0].impression, 'liked');
  assert.equal(result.updatesCount, 3);
  assert.equal(result.crowds[0].id, id(1));
  assert.equal(result.bathrooms[0].id, id(3));
  assert.equal(result.prices[0].id, id(5));
});

test('update statistics sum crowd, bathroom and price submissions without adding impressions twice', () => {
  const result = view({
    impressions: saved(impression('liked'), impression('fine', barB)), crowdReports: [crowd(1), crowd(2)],
    bathroomReviews: [bathroom(3)], priceObservations: [price(4), price(5), price(6)],
  });
  assert.deepEqual(result.counts, { impressions: 2, crowdReports: 2, bathroomReviews: 1, priceObservations: 3 });
  assert.equal(result.updatesCount, 6);
});

test('opening venues and merely generating comparison pairs never creates impressions or visits', () => {
  const result = view({ ...empty(), openedVenueIds: [barA, barB] });
  assert.equal(result.counts.impressions, 0);
  assert.equal(result.updatesCount, 0);
  assert.ok(!('visited' in result));
  const personal = createPersonalComparisonState(SESSION_USER_ID, [barA, barB]);
  assert.equal(selectPersonalRankings(personal, mockVenues).completedCount, 0);
});

test('only saved preference votes count as personal comparisons; skipping preserves counts and history', () => {
  let state = createPersonalComparisonState(SESSION_USER_ID, [barA, barB]);
  state = personalComparisonReducer(state, { type: 'skip', round: state.round });
  assert.equal(selectPersonalRankings(state, mockVenues).completedCount, 0);
  state = personalComparisonReducer(state, { type: 'vote', round: state.round, comparison: {
    id: id(1), user_id: SESSION_USER_ID, winner_bar_id: barA, loser_bar_id: barB, created_at: iso(),
  } });
  assert.equal(selectPersonalRankings(state, mockVenues).completedCount, 1);
  const history = state.history;
  state = personalComparisonReducer(state, { type: 'advance', round: state.round });
  state = personalComparisonReducer(state, { type: 'skip', round: state.round });
  assert.equal(selectPersonalRankings(state, mockVenues).completedCount, 1);
  assert.equal(state.history, history);
});

test('pending languages and private incidents cannot enter the public activity projection or inflate its totals', () => {
  const description = 'PRIVATE_DESCRIPTION_FOR_TEST_ONLY';
  let extras = venueExtrasReducer(initialVenueExtrasState, { type: 'suggest-language', associatedCodes: [], suggestion: {
    id: id(1), bar_id: barA, suggested_by: SESSION_USER_ID, language_code: 'fr', status: 'pending', created_at: iso(),
  } });
  extras = venueExtrasReducer(extras, { type: 'report-incident', report: {
    id: id(2), bar_id: barA, reporter_id: SESSION_USER_ID, category: 'Theft', description,
    occurred_at: null, status: 'pending', created_at: iso(),
  } });
  const result = view({ ...empty(), ...extras });
  assert.deepEqual(result, view(empty()));
  const json = JSON.stringify(result);
  assert.ok(!json.includes(description));
  assert.ok(!json.includes('languageSuggestions'));
  assert.ok(!json.includes('privateIncidentReports'));
});

test('a future duplicated bathroom snapshot still counts one editable review per user and venue', () => {
  const result = view({ ...empty(), bathroomReviews: [
    bathroom(1, [1, 1, 1]), bathroom(2, [5, 4, 3]), bathroom(3, [2, 2, 2], otherUser),
  ] });
  assert.equal(result.counts.bathroomReviews, 1);
  assert.equal(result.bathrooms[0].cleanliness, 5);
});

test('missing venue or catalog metadata keeps saved counts visible without inventing names, serving sizes or links', () => {
  const result = view({ ...empty(), impressions: saved(impression()), priceObservations: [price(1)] }, [], []);
  assert.equal(result.counts.impressions, 1);
  assert.equal(result.counts.priceObservations, 1);
  assert.equal(result.impressions[0].venue.name, 'Venue unavailable');
  assert.equal(result.impressions[0].venue.available, false);
  assert.equal(result.prices[0].drinkName, 'Drink unavailable');
  assert.equal(result.prices[0].servingMl, null);
});

test('activity selection is read-only and exposes no account credentials or incidental private fields', () => {
  const source = Object.freeze({
    impressions: Object.freeze(saved(impression())),
    crowdReports: Object.freeze([Object.freeze(crowd(1))]),
    bathroomReviews: Object.freeze([Object.freeze(bathroom(2))]),
    priceObservations: Object.freeze([Object.freeze(price(3))]),
    email: 'DO_NOT_EXPOSE', password: 'DO_NOT_EXPOSE',
  });
  const before = JSON.stringify(source);
  const result = view(source);
  assert.equal(JSON.stringify(source), before);
  assert.ok(!JSON.stringify(result).includes('DO_NOT_EXPOSE'));
  assert.deepEqual(Object.keys(result).sort(), ['impressions', 'crowds', 'bathrooms', 'prices', 'counts', 'updatesCount'].sort());
});

test('Profile activity links open the venue UUID and preserve the Profile return path', () => {
  const entry = view({ ...empty(), impressions: saved(impression()) }).impressions[0];
  assert.deepEqual(venueFromProfileHref(entry.venue.id), { pathname: '/bars/[barId]', params: { barId: barA, returnTo: 'profile' } });
  const calls = [];
  const plan = resolveBarDetailsBack('profile', null);
  assert.equal(plan.label, 'Back to Profile');
  const navigation = {
    canGoBack: () => true, back: () => calls.push('back'),
    replace: (href) => calls.push(href), dismissTo: (href) => calls.push(href),
  };
  navigateBackFromBarDetails(plan, navigation);
  assert.deepEqual(calls, ['back']);
  calls.length = 0;
  navigateBackFromBarDetails(plan, { ...navigation, canGoBack: () => false });
  assert.deepEqual(calls, [{ pathname: '/profile' }]);
});
