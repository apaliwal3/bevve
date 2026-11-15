import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mockVenues } from '../src/fixtures/venues.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import {
  createPersonalComparisonState, pairKey, personalComparisonReducer,
} from '../src/features/comparisons/comparison-state.ts';
import { selectPersonalRankings } from '../src/features/rankings/personal-rankings.ts';
import {
  navigateBackFromBarDetails, resolveBarDetailsBack, venueFromRankingsHref,
} from '../src/features/venues/bar-details-navigation.ts';

const [barA, barB, barC, barD] = mockVenues.map((venue) => venue.id);
const ids = [barA, barB, barC, barD];
const initial = (venueIds = ids) => createPersonalComparisonState(SESSION_USER_ID, venueIds);
const advance = (state) => personalComparisonReducer(state, { type: 'advance', round: state.round });
const skip = (state) => personalComparisonReducer(state, { type: 'skip', round: state.round });
const vote = (state, number, winner = state.pair[0]) => personalComparisonReducer(state, {
  type: 'vote', round: state.round, comparison: {
    id: 'e98f6a21-fc7c-47dd-a82d-' + number.toString(16).padStart(12, '0'),
    user_id: SESSION_USER_ID, winner_bar_id: winner, loser_bar_id: state.pair.find((venue) => venue !== winner),
    created_at: new Date(Date.parse('2026-11-15T20:00:00Z') + number).toISOString(),
  },
});
const view = (state, venues = mockVenues) => selectPersonalRankings(state, venues);
function seekPair(state, first, second) {
  if (state.phase === 'feedback') state = advance(state);
  for (let index = 0; index < 24; index++) {
    if (pairKey(state.pair) === pairKey([first, second])) return state;
    state = skip(state);
  }
  throw new Error('Expected pair was not offered.');
}
function fakeNavigation(canGoBack) {
  const calls = [];
  return {
    calls,
    router: {
      canGoBack: () => canGoBack,
      back: () => calls.push(['back']),
      replace: (href) => calls.push(['replace', href]),
      dismissTo: (href) => calls.push(['dismissTo', href]),
    },
  };
}

test('no comparisons produces an empty personal ranking despite populated community fixtures', () => {
  assert.ok(mockVenues[0].communityRating.average > 0);
  assert.deepEqual(view(initial()), { entries: [], completedCount: 0 });
  assert.deepEqual(view(skip(initial())), { entries: [], completedCount: 0 });
  assert.deepEqual(view(initial([]), []), { entries: [], completedCount: 0 });
  assert.deepEqual(view(initial([barA]), [mockVenues[0]]), { entries: [], completedCount: 0 });
});

test('the first vote ranks only its two participants with ordinal positions and comparison counts', () => {
  const state = vote(initial(), 1, barB);
  const result = view(state);
  assert.deepEqual(result.entries.map((entry) => [entry.position, entry.venue.id, entry.comparisonCount]), [
    [1, barB, 1], [2, barA, 1],
  ]);
  assert.equal(result.completedCount, 1);
  assert.ok(!result.entries.some((entry) => entry.venue.id === barC || entry.venue.id === barD));
  assert.deepEqual(result.entries.map((entry) => entry.venue.id), state.rankings.map((row) => row.bar_id));
});

test('new and repeated votes immediately update the existing ranking without another history', () => {
  const first = vote(initial([barA, barB]), 1, barA);
  const firstView = view(first);
  assert.equal(firstView.entries[0].venue.id, barA);
  const second = vote(advance(first), 2, barB);
  assert.equal(view(second).entries[0].venue.id, barB);
  assert.equal(view(second).completedCount, 2);
  const third = vote(advance(second), 3, barB);
  assert.equal(view(third).entries[0].venue.id, barB);
  assert.deepEqual(view(third).entries.map((entry) => entry.comparisonCount), [3, 3]);
  assert.equal(third.history.length, 3);
  assert.equal(first.history.length, 1);
  assert.equal(firstView.entries[0].venue.id, barA);
});

test('Skip preserves personal ranking order, comparison counts, and the original ranking references', () => {
  const state = advance(vote(initial(), 1));
  const next = skip(state);
  assert.equal(next.rankings, state.rankings);
  assert.equal(next.history, state.history);
  assert.deepEqual(view(next), view(state));
});

test('ties keep the Stage 6A/backend UUID order rather than venue-name or catalog order', () => {
  let state = vote(initial(), 1, barA);
  state = seekPair(state, barC, barD);
  state = vote(state, 2, barC);
  assert.equal(state.rankings[0].score, state.rankings[1].score);
  assert.equal(state.rankings[2].score, state.rankings[3].score);
  const renamed = [...mockVenues].reverse().map((venue, index) => ({ ...venue, name: String.fromCharCode(65 + index) }));
  const result = view(state, renamed);
  assert.deepEqual(result.entries.map((entry) => entry.venue.id), [barA, barC, barB, barD]);
  assert.deepEqual(result.entries.map((entry) => entry.position), [1, 2, 3, 4]);
});

test('venue review data cannot change personal ordering or add uncompared venues', () => {
  const state = vote(initial(), 1, barB);
  const changedReviews = mockVenues.map((venue) => ({
    ...venue, communityRating: { average: 5, count: 10000 }, bathroomCleanliness: 5,
    crowd: { level: 5, label: 'Packed' }, startingPriceCents: 50,
  }));
  assert.deepEqual(view(state, changedReviews), view(state));
  const withViolet = vote(seekPair(state, barC, barD), 2, barD);
  assert.equal(mockVenues[3].communityRating, null);
  assert.ok(view(withViolet).entries.some((entry) => entry.venue.id === barD));
});

test('the public ranking view exposes no Elo or review scores and does not mutate the cache or history', () => {
  const state = vote(initial(), 1);
  const frozen = Object.freeze({
    rankings: Object.freeze(state.rankings.map((row) => Object.freeze({ ...row }))),
    history: Object.freeze(state.history.map((row) => Object.freeze({ ...row }))),
  });
  const before = JSON.stringify(frozen);
  const result = view(frozen);
  assert.deepEqual(Object.keys(result).sort(), ['entries', 'completedCount'].sort());
  assert.deepEqual(Object.keys(result.entries[0]).sort(), ['position', 'venue', 'comparisonCount'].sort());
  assert.deepEqual(Object.keys(result.entries[0].venue).sort(), ['id', 'name', 'area', 'vibe', 'image'].sort());
  assert.equal(JSON.stringify(frozen), before);
});

test('venue joins use normalized UUIDs and keep unique available rows in the existing ranking order', () => {
  const state = vote(initial(), 1, barB);
  const upperCase = mockVenues.map((venue) => ({ ...venue, id: venue.id.toUpperCase() }));
  assert.deepEqual(view(state, upperCase), view(state));
  assert.equal(view(state, [...mockVenues, mockVenues[0]]).entries.length, 2);
  const partial = view(state, [mockVenues[0]]);
  assert.deepEqual(partial.entries.map((entry) => [entry.position, entry.venue.id]), [[1, barA]]);
  assert.equal(partial.completedCount, 1);
});

test('ranked venue links preserve their UUID and carry a Rankings return context', () => {
  const entry = view(vote(initial(), 1)).entries[0];
  assert.deepEqual(venueFromRankingsHref(entry.venue.id), {
    pathname: '/bars/[barId]', params: { barId: entry.venue.id, returnTo: 'rankings' },
  });
});

test('Back from a ranked venue pops to Rankings and never redirects to Explore', () => {
  const plan = resolveBarDetailsBack('rankings', null);
  assert.equal(plan.label, 'Back to Rankings');
  const navigation = fakeNavigation(true);
  navigateBackFromBarDetails(plan, navigation.router);
  assert.deepEqual(navigation.calls, [['back']]);
  const directLink = fakeNavigation(false);
  navigateBackFromBarDetails(plan, directLink.router);
  assert.deepEqual(directLink.calls, [['replace', { pathname: '/rankings' }]]);
});

test('Compare and Explore retain their previous back behavior', () => {
  const compare = fakeNavigation(false);
  navigateBackFromBarDetails(resolveBarDetailsBack('compare', null), compare.router);
  assert.deepEqual(compare.calls, [['replace', { pathname: '/compare' }]]);
  const explore = fakeNavigation(true);
  navigateBackFromBarDetails(resolveBarDetailsBack(undefined, null), explore.router);
  assert.deepEqual(explore.calls, [['dismissTo', { pathname: '/explore' }]]);
});

test('price comparison back navigation keeps the selected drink and source venue', () => {
  const drinkId = 'b3eaae75-0317-4411-9814-7e7a79f4b102';
  const plan = resolveBarDetailsBack('prices', drinkId, barA);
  assert.equal(plan.label, 'Back to drink prices');
  const directLink = fakeNavigation(false);
  navigateBackFromBarDetails(plan, directLink.router);
  assert.deepEqual(directLink.calls, [['replace', {
    pathname: '/prices', params: { drinkId, sourceBarId: barA },
  }]]);
  const stacked = fakeNavigation(true);
  navigateBackFromBarDetails(plan, stacked.router);
  assert.deepEqual(stacked.calls, [['back']]);
});

test('unknown or repeated return parameters cannot redirect outside the app', () => {
  for (const returnTo of ['https://example.com', 'unknown', ['rankings', 'prices']]) {
    const result = resolveBarDetailsBack(returnTo, null);
    assert.equal(result.mode, 'dismiss');
    assert.deepEqual(result.href, { pathname: '/explore' });
  }
});
