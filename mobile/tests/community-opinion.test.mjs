import assert from 'node:assert/strict';
import { test } from 'node:test';

import { calculateCommunityOpinion } from '../src/features/sentiments/community-opinion.ts';
import { getUserVenueSentiment, initialVenueSentimentsState, saveVenueSentiment } from '../src/features/sentiments/sentiment-state.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';

const barA = mockVenues[0].id;
const barB = mockVenues[1].id;
const user = (number) => '97c0c196-e3f2-4d15-9c53-' + number.toString(16).padStart(12, '0');
const time = (offset = 0) => new Date(Date.parse('2026-11-18T20:00:00Z') + offset).toISOString();
// Synthetic test records only; no app fixtures are converted into real opinions.
const opinion = (number, sentiment = 'liked', fields = {}) => ({
  user_id: user(number), bar_id: barA, sentiment, source: 'community', updated_at: time(), ...fields,
});

test('the percentage includes fine and disliked opinions in the distinct-user denominator', () => {
  const result = calculateCommunityOpinion([
    opinion(1), opinion(2), opinion(3, 'fine'), opinion(4, 'disliked'),
  ], barA);
  assert.deepEqual(result, {
    likedCount: 2, fineCount: 1, dislikedCount: 1, totalDistinctOpinions: 4,
    likedPercentage: 50, sufficiency: 'unresolved',
  });
});

test('percentages retain raw precision rather than rounding or weighting neutral opinions', () => {
  const result = calculateCommunityOpinion([opinion(1), opinion(2, 'fine'), opinion(3, 'disliked')], barA);
  assert.equal(result.likedPercentage, 1 / 3 * 100);
  for (const sentiment of ['liked', 'fine', 'disliked']) {
    const single = calculateCommunityOpinion([opinion(1, sentiment)], barA);
    assert.equal(single.totalDistinctOpinions, 1);
    assert.equal(single.likedPercentage, sentiment === 'liked' ? 100 : 0);
  }
});

test('zero opinions returns no percentage and no invented sufficiency policy', () => {
  assert.deepEqual(calculateCommunityOpinion([], barA), {
    likedCount: 0, fineCount: 0, dislikedCount: 0, totalDistinctOpinions: 0,
    likedPercentage: null, sufficiency: 'unresolved',
  });
});

test('each user contributes only their latest eligible sentiment, independent of timestamp representation or order', () => {
  const older = opinion(1, 'liked', { updated_at: '2026-11-18T21:00:00+01:00' });
  const latest = opinion(1, 'disliked', { updated_at: time(1000) });
  const rows = [latest, older, latest, opinion(2, 'fine'), opinion(1, 'liked', { bar_id: barB })];
  const result = calculateCommunityOpinion(rows, barA);
  assert.equal(result.totalDistinctOpinions, 2);
  assert.equal(result.likedCount, 0);
  assert.equal(result.dislikedCount, 1);
  assert.deepEqual(calculateCommunityOpinion([...rows].reverse(), barA), result);
});

test('case variants of user and venue UUIDs never inflate opinion counts', () => {
  const rows = [opinion(1), opinion(1, 'fine', {
    user_id: user(1).toUpperCase(), bar_id: barA.toUpperCase(), updated_at: time(1),
  })];
  const result = calculateCommunityOpinion(rows, barA.toUpperCase());
  assert.equal(result.totalDistinctOpinions, 1);
  assert.equal(result.fineCount, 1);
  assert.equal(result.likedPercentage, 0);
});

test('demo provenance excludes the mock contributor, and star fixtures cannot fabricate opinions', () => {
  assert.ok(mockVenues[0].communityRating.count > 0);
  const state = saveVenueSentiment(initialVenueSentimentsState, opinion(1, 'liked', { user_id: SESSION_USER_ID, source: 'demo' }));
  const demo = getUserVenueSentiment(state, SESSION_USER_ID, barA);
  const result = calculateCommunityOpinion([demo, ...mockVenues], barA);
  assert.equal(result.totalDistinctOpinions, 0);
  assert.equal(result.likedPercentage, null);
  const mixed = calculateCommunityOpinion([demo, opinion(2, 'fine')], barA);
  assert.equal(mixed.totalDistinctOpinions, 1);
  assert.equal(mixed.likedCount, 0);
});

test('an explicit eligibility rule applies before selecting each user’s latest eligible snapshot', () => {
  const rows = [opinion(1), opinion(1, 'disliked', { updated_at: time(1) }), opinion(2)];
  const result = calculateCommunityOpinion(rows, barA, { isEligible: (record) => record.updated_at === time() && record.user_id !== user(2) });
  assert.equal(result.totalDistinctOpinions, 1);
  assert.equal(result.likedCount, 1);
});

test('the opinion minimum is supplied by the caller, with exact boundary behavior and no default', () => {
  const rows = [opinion(1), opinion(2, 'fine')];
  assert.equal(calculateCommunityOpinion(rows, barA).sufficiency, 'unresolved');
  assert.equal(calculateCommunityOpinion(rows, barA, { minimumOpinions: null }).sufficiency, 'unresolved');
  const configuredMinimum = rows.length;
  assert.equal(calculateCommunityOpinion(rows.slice(1), barA, { minimumOpinions: configuredMinimum }).sufficiency, 'insufficient');
  assert.equal(calculateCommunityOpinion(rows, barA, { minimumOpinions: configuredMinimum }).sufficiency, 'sufficient');
  assert.equal(calculateCommunityOpinion([], barA, { minimumOpinions: configuredMinimum }).sufficiency, 'insufficient');
  assert.equal(calculateCommunityOpinion([...rows, opinion(3)], barA, { minimumOpinions: configuredMinimum }).sufficiency, 'sufficient');
  for (const minimumOpinions of [0, -1, 1.5, NaN, Infinity, '2']) {
    assert.throws(() => calculateCommunityOpinion(rows, barA, { minimumOpinions }));
  }
});

test('invalid or unprovenanced records and records from other venues cannot enter totals', () => {
  const invalid = [
    null, {}, opinion(1, 'unknown'), opinion(1, 'liked', { source: undefined }),
    opinion(1, 'liked', { source: 'fixture' }), opinion(1, 'liked', { updated_at: 'invalid' }),
    opinion(1, 'liked', { user_id: '1' }), opinion(1, 'liked', { bar_id: '1' }),
    opinion(1, 'liked', { bar_id: barB }),
  ];
  assert.deepEqual(calculateCommunityOpinion(invalid, barA), calculateCommunityOpinion([], barA));
  assert.throws(() => calculateCommunityOpinion([], 'invalid'));
});

test('equal-time snapshots use the later supplied edit without creating a second opinion', () => {
  const result = calculateCommunityOpinion([opinion(1), opinion(1, 'fine')], barA);
  assert.equal(result.totalDistinctOpinions, 1);
  assert.equal(result.fineCount, 1);
});

test('aggregation leaves frozen records unchanged and returns counts without user identities', () => {
  const rows = Object.freeze([Object.freeze(opinion(1)), Object.freeze(opinion(2, 'disliked'))]);
  const before = JSON.stringify(rows);
  const result = calculateCommunityOpinion(rows, barA);
  assert.equal(JSON.stringify(rows), before);
  assert.deepEqual(Object.keys(result).sort(), [
    'likedCount', 'fineCount', 'dislikedCount', 'totalDistinctOpinions', 'likedPercentage', 'sufficiency',
  ].sort());
  assert.ok(!JSON.stringify(result).includes(user(1)));
});
