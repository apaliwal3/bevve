import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  experiencedVenueIds, getUserVenueImpression, initialVenueImpressionsState,
  saveVenueImpression, impressionValues,
} from '../src/features/impressions/impression-state.ts';
import {
  calculatePersonalRankings, createPersonalComparisonState, personalComparisonReducer,
} from '../src/features/comparisons/comparison-state.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';

const userA = SESSION_USER_ID;
const userB = '97c0c196-e3f2-4d15-9c53-81757f652dd2';
const barA = 'b3eaae75-0317-4411-9814-7e7a79f4b001';
const barB = 'b3eaae75-0317-4411-9814-7e7a79f4b002';
const time = (offset = 0) => new Date(Date.parse('2026-11-18T20:00:00Z') + offset).toISOString();
const opinion = (impression = 'liked', fields = {}) => ({
  user_id: userA, bar_id: barA, impression, source: 'demo', updated_at: time(), ...fields,
});

test('first save creates one user/venue impression without mutating the initial state', () => {
  const before = Object.freeze({});
  const state = saveVenueImpression(before, opinion());
  assert.deepEqual(state, { [userA]: { [barA]: opinion() } });
  assert.deepEqual(before, initialVenueImpressionsState);
  assert.deepEqual(getUserVenueImpression(state, userA, barA), opinion());
});

test('editing replaces the answer for the same user/venue and preserves previous snapshots', () => {
  const first = saveVenueImpression(initialVenueImpressionsState, opinion());
  Object.freeze(first[userA][barA]);
  Object.freeze(first[userA]);
  Object.freeze(first);
  const edited = saveVenueImpression(first, opinion('disliked', { updated_at: time(1) }));
  assert.equal(getUserVenueImpression(edited, userA, barA).impression, 'disliked');
  assert.equal(getUserVenueImpression(first, userA, barA).impression, 'liked');
  assert.equal(Object.keys(edited[userA]).length, 1);
});

test('repeated saves and edits never add duplicate user/venue records', () => {
  let state = saveVenueImpression(initialVenueImpressionsState, opinion());
  assert.equal(saveVenueImpression(state, opinion()), state);
  for (let index = 0; index < 100; index++) {
    state = saveVenueImpression(state, opinion(impressionValues[index % 3], { updated_at: time(index) }));
  }
  assert.deepEqual(Object.keys(state), [userA]);
  assert.deepEqual(Object.keys(state[userA]), [barA]);
});

test('save and lookup normalize user and venue UUID case independently', () => {
  const state = saveVenueImpression(initialVenueImpressionsState, opinion('fine', {
    user_id: userA.toUpperCase(), bar_id: barA.toUpperCase(), updated_at: '2026-11-18T21:00:00+01:00',
  }));
  assert.deepEqual(getUserVenueImpression(state, userA.toUpperCase(), barA.toUpperCase()), opinion('fine'));
  assert.deepEqual(Object.keys(state), [userA]);
  assert.deepEqual(Object.keys(state[userA]), [barA]);
});

test('different users and venues remain isolated, including swapped user/venue identities', () => {
  let state = saveVenueImpression(initialVenueImpressionsState, opinion());
  state = saveVenueImpression(state, opinion('fine', { user_id: userB }));
  state = saveVenueImpression(state, opinion('disliked', { bar_id: barB }));
  state = saveVenueImpression(state, opinion('fine', { user_id: barA, bar_id: userA }));
  const beforeOtherUser = state[userB];
  state = saveVenueImpression(state, opinion('disliked', { updated_at: time(1) }));
  assert.equal(state[userB], beforeOtherUser);
  assert.equal(getUserVenueImpression(state, userB, barA).impression, 'fine');
  assert.equal(getUserVenueImpression(state, userA, barB).impression, 'disliked');
  assert.equal(getUserVenueImpression(state, barA, userA).impression, 'fine');
  assert.equal(getUserVenueImpression(state, userB, barB), null);
});

test('only saved impressions establish experience; first/second venues and current-venue exclusion work', () => {
  assert.deepEqual(experiencedVenueIds(initialVenueImpressionsState, userA), []);
  assert.deepEqual(experiencedVenueIds({ [userA]: { [barA]: undefined } }, userA), []);
  let state = saveVenueImpression(initialVenueImpressionsState, opinion());
  assert.deepEqual(experiencedVenueIds(state, userA, barA), []);
  state = saveVenueImpression(state, opinion('disliked', { bar_id: barB }));
  state = saveVenueImpression(state, opinion('fine', { user_id: userB }));
  assert.deepEqual(experiencedVenueIds(state, userA.toUpperCase(), barB.toUpperCase()), [barA]);
  assert.deepEqual(experiencedVenueIds(state, userA), [barA, barB]);
  assert.deepEqual(experiencedVenueIds(state, userB), [barA]);
  state = saveVenueImpression(state, opinion('fine', { updated_at: time(1) }));
  assert.deepEqual(experiencedVenueIds(state, userA), [barA, barB]);
});

test('all three stable impression values save without converting them to numeric scores', () => {
  assert.deepEqual(impressionValues, ['liked', 'fine', 'disliked']);
  for (const impression of impressionValues) {
    const state = saveVenueImpression(initialVenueImpressionsState, opinion(impression));
    assert.equal(getUserVenueImpression(state, userA, barA).impression, impression);
    assert.deepEqual(experiencedVenueIds(state, userA), [barA]);
    assert.ok(!('score' in state[userA][barA]));
  }
});

test('invalid identifiers, categories, provenance and timestamps cannot save impressions', () => {
  const before = Object.freeze({});
  for (const fields of [
    { user_id: 'user' }, { bar_id: 'venue' }, { user_id: null }, { bar_id: 1 },
    { impression: 'Liked' }, { impression: 5 }, { impression: null },
    { source: undefined }, { source: 'fixture' }, { updated_at: 'invalid' }, { updated_at: null },
  ]) assert.throws(() => saveVenueImpression(before, opinion('liked', fields)));
  assert.equal(getUserVenueImpression(before, 'invalid', barA), null);
  assert.equal(getUserVenueImpression(before, userA, 'invalid'), null);
  assert.deepEqual(experiencedVenueIds(before, 'invalid'), []);
  assert.deepEqual(before, {});
});

test('stale saves cannot undo edits; equal-time edits follow call order', () => {
  const state = saveVenueImpression(initialVenueImpressionsState, opinion('fine', { updated_at: time(10) }));
  assert.equal(saveVenueImpression(state, opinion('liked', { updated_at: time(9) })), state);
  const edited = saveVenueImpression(state, opinion('disliked', { updated_at: time(10) }));
  assert.equal(getUserVenueImpression(edited, userA, barA).impression, 'disliked');
});

test('impression saves and preference votes leave each other unchanged and preserve Elo calculations', () => {
  const initialPersonal = createPersonalComparisonState(userA, [barA, barB]);
  const personal = personalComparisonReducer(initialPersonal, { type: 'vote', round: initialPersonal.round, comparison: {
    id: 'e98f6a21-fc7c-47dd-a82d-000000000001', user_id: userA,
    winner_bar_id: barA, loser_bar_id: barB, created_at: time(),
  } });
  const beforePersonal = JSON.stringify(personal);
  let state = initialVenueImpressionsState;
  for (const [index, impression] of impressionValues.entries()) {
    state = saveVenueImpression(state, opinion(impression, { updated_at: time(index) }));
    assert.equal(JSON.stringify(personal), beforePersonal);
  }
  assert.deepEqual(personal.rankings, [
    { bar_id: barA, score: 1016, comparisons: 1 }, { bar_id: barB, score: 984, comparisons: 1 },
  ]);
  assert.deepEqual(personal.rankings, calculatePersonalRankings(personal.history));
  assert.deepEqual(initialPersonal.history, []);
  const beforeImpressions = JSON.stringify(state);
  const ready = personalComparisonReducer(personal, { type: 'advance', round: personal.round });
  const second = personalComparisonReducer(ready, { type: 'vote', round: ready.round, comparison: {
    id: 'e98f6a21-fc7c-47dd-a82d-000000000002', user_id: userA,
    winner_bar_id: barB, loser_bar_id: barA, created_at: time(10),
  } });
  assert.equal(second.history.length, 2);
  assert.equal(JSON.stringify(state), beforeImpressions);
});
