import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  aggregateBathroomReviews,
  aggregateCrowdReports,
  contributionsReducer,
  initialContributionsState,
  latestUserCrowdReport,
  SESSION_USER_ID,
  CROWD_WINDOW_MS,
} from '../src/features/contributions/contribution-state.ts';
import {
  bathroomDraftFromSaved, bathroomDraftReducer, completeBathroomDraft, crowdDraftReducer,
} from '../src/features/contributions/contribution-drafts.ts';
import { saveVenueImpression } from '../src/features/impressions/impression-state.ts';
import { mockVenueDetails, mockVenues } from '../src/fixtures/venues.ts';

const barA = mockVenues[0].id;
const barB = mockVenues[3].id;
const userA = SESSION_USER_ID;
const userB = '97c0c196-e3f2-4d15-9c53-81757f652dd2';
const userC = '97c0c196-e3f2-4d15-9c53-81757f652dd3';
const userD = '97c0c196-e3f2-4d15-9c53-81757f652dd4';
const now = Date.parse('2026-11-15T20:00:00Z');
const iso = (offset = 0) => new Date(now + offset).toISOString();
const id = (number) => `e98f6a21-fc7c-47dd-a82d-${number.toString(16).padStart(12, '0')}`;
const report = (number, user = userA, level = 4, offset = 0, bar = barA) => ({
  id: id(number), user_id: user, bar_id: bar, level, created_at: iso(offset),
});
const review = (number, scores = [4, 3, 5], user = userA, bar = barA, offset = 0) => ({
  id: id(number), user_id: user, bar_id: bar,
  cleanliness: scores[0], accessibility: scores[1], wait_time: scores[2],
  created_at: iso(offset), updated_at: iso(offset),
});
const saveCrowd = (state, row) => contributionsReducer(state, { type: 'submit-crowd', report: row });
const saveBathroom = (state, row) => contributionsReducer(state, { type: 'save-bathroom', review: row });

test('crowd submissions retain timestamps/history while only the latest contributor report counts', () => {
  const previous = Object.freeze({ crowdReports: Object.freeze([]), bathroomReviews: Object.freeze([]) });
  const first = saveCrowd(previous, report(1, userA, 5, -1000));
  const next = saveCrowd(first, report(2, userA, 1));
  assert.equal(next.crowdReports.length, 2);
  assert.equal(first.crowdReports.length, 1);
  assert.equal(next.crowdReports[1].created_at, iso());
  assert.deepEqual(aggregateCrowdReports(next.crowdReports, barA, now), {
    score: 1, report_count: 1, newest_report_at: iso(), classification: null,
  });
  assert.equal(latestUserCrowdReport(next.crowdReports, barA, userA).level, 1);
  assert.equal(saveCrowd(next, report(2, userA, 1)), next);
});

test('classification requires three distinct contributors and matches backend thresholds', () => {
  assert.equal(aggregateCrowdReports([report(1), report(2, userB)], barA, now).classification, null);
  const rows = [report(1, userA, 1), report(2, userB, 1), report(3, userC, 1)];
  assert.equal(aggregateCrowdReports(rows, barA, now).classification, 'quiet');
  assert.equal(aggregateCrowdReports([report(1, userA, 1), report(2, userB, 2), report(3, userC, 3)], barA, now).classification, 'moderate');
  const busy = [report(1, userA, 3), report(2, userB, 3), report(3, userC, 4), report(4, userD, 4)];
  assert.equal(aggregateCrowdReports(busy, barA, now).score, 3.5);
  assert.equal(aggregateCrowdReports(busy, barA, now).classification, 'busy');
});

test('the 45-minute boundary is inclusive; stale, future and other-venue reports are excluded', () => {
  const rows = [
    report(1, userA, 1, -CROWD_WINDOW_MS),
    report(2, userB, 5, -CROWD_WINDOW_MS - 1),
    report(3, userC, 5, 1),
    report(4, userD, 5, 0, barB),
  ];
  assert.equal(aggregateCrowdReports(rows, barA, now).report_count, 1);
  assert.equal(aggregateCrowdReports(rows, barA, now).score, 1);
  assert.deepEqual(aggregateCrowdReports([rows[0]], barA, now + 1), {
    score: null, report_count: 0, newest_report_at: null, classification: null,
  });
});

test('same-time crowd reports use the SQL ID tie-break regardless of input order', () => {
  const rows = [report(1, userA, 1), report(2, userA, 5)];
  assert.equal(aggregateCrowdReports(rows, barA, now).score, 5);
  assert.deepEqual(aggregateCrowdReports(rows, barA, now), aggregateCrowdReports([...rows].reverse(), barA, now));
});

test('fictional crowd fixtures never inflate actual session contributor counts', () => {
  const fixturesBefore = JSON.stringify(mockVenueDetails);
  assert.ok(mockVenueDetails[barA].crowd.reportCount >= 3);
  const state = saveCrowd(initialContributionsState, report(1));
  const summary = aggregateCrowdReports(state.crowdReports, barA, now);
  assert.equal(summary.report_count, 1);
  assert.equal(summary.classification, null);
  assert.equal(JSON.stringify(mockVenueDetails), fixturesBefore);
});

test('bathroom submission and edits keep one review, its ID and original creation time', () => {
  const first = saveBathroom(initialContributionsState, review(1));
  const edited = saveBathroom(first, review(2, [2, 5, 1], userA, barA, 1000));
  assert.equal(edited.bathroomReviews.length, 1);
  assert.equal(edited.bathroomReviews[0].id, id(1));
  assert.equal(edited.bathroomReviews[0].created_at, iso());
  assert.equal(edited.bathroomReviews[0].updated_at, iso(1000));
  const summary = aggregateBathroomReviews(edited.bathroomReviews, barA);
  assert.equal(summary.reviewCount, 1);
  assert.equal(summary.cleanliness.average, 2);
  assert.equal(summary.accessibility.average, 5);
  assert.equal(summary.waitTime.average, 1);
  assert.equal(first.bathroomReviews[0].cleanliness, 4);
});

test('bathroom summaries use each field count and never mutate the fictional baseline', () => {
  const baseline = mockVenueDetails[barA].bathrooms;
  const before = JSON.stringify(baseline);
  let state = saveBathroom(initialContributionsState, review(1));
  state = saveBathroom(state, review(2, [1, 2, 3], userA, barA, 1000));
  const summary = aggregateBathroomReviews(state.bathroomReviews, barA, baseline);
  assert.equal(summary.reviewCount, baseline.reviewCount + 1);
  assert.equal(summary.cleanliness.count, baseline.cleanliness.count + 1);
  assert.equal(summary.cleanliness.average, (baseline.cleanliness.average * baseline.cleanliness.count + 1) / (baseline.cleanliness.count + 1));
  assert.equal(summary.accessibility.count, baseline.accessibility.count + 1);
  assert.equal(summary.waitTime.average, (baseline.waitTime.average * baseline.waitTime.count + 3) / (baseline.waitTime.count + 1));
  assert.equal(JSON.stringify(baseline), before);
});

test('users and venues are isolated and an optional field with no baseline starts at one', () => {
  let state = saveBathroom(initialContributionsState, review(1));
  state = saveBathroom(state, review(2, [2, 3, 4], userB));
  state = saveBathroom(state, review(3, [5, 5, 5], userA, barB));
  assert.equal(aggregateBathroomReviews(state.bathroomReviews, barA).reviewCount, 2);
  assert.equal(aggregateBathroomReviews(state.bathroomReviews, barB).cleanliness.average, 5);
  const baseline = { reviewCount: 10, cleanliness: { average: 4, count: 10 }, accessibility: { average: null, count: 0 }, waitTime: { average: 2, count: 5 } };
  const summary = aggregateBathroomReviews([state.bathroomReviews[0]], barA, baseline);
  assert.deepEqual(summary.accessibility, { average: 3, count: 1 });
  assert.equal(aggregateBathroomReviews([], barB), null);
});

test('all three bathroom categories are required before submission', () => {
  assert.equal(completeBathroomDraft({}), false);
  let draft = bathroomDraftFromSaved(null);
  assert.equal(completeBathroomDraft(draft), false);
  draft = bathroomDraftReducer(draft, { type: 'rate', category: 'cleanliness', rating: 4 });
  draft = bathroomDraftReducer(draft, { type: 'rate', category: 'accessibility', rating: 3 });
  assert.equal(completeBathroomDraft(draft), false);
  draft = bathroomDraftReducer(draft, { type: 'rate', category: 'wait_time', rating: 5 });
  assert.equal(completeBathroomDraft(draft), true);
  const state = saveBathroom(initialContributionsState, { ...review(1), ...draft });
  assert.equal(aggregateBathroomReviews(state.bathroomReviews, barA).waitTime.average, 5);
});

test('Cancel discards new crowd and bathroom drafts without creating submissions', () => {
  const saved = Object.freeze({ crowdReports: Object.freeze([]), bathroomReviews: Object.freeze([]) });
  let crowdDraft = crowdDraftReducer(null, { type: 'select', level: 4 });
  crowdDraft = crowdDraftReducer(crowdDraft, { type: 'cancel', saved: null });
  assert.equal(crowdDraft, null);
  let bathroomDraft = bathroomDraftReducer(bathroomDraftFromSaved(null), { type: 'rate', category: 'cleanliness', rating: 5 });
  bathroomDraft = bathroomDraftReducer(bathroomDraft, { type: 'cancel', saved: null });
  assert.equal(completeBathroomDraft(bathroomDraft), false);
  assert.deepEqual(bathroomDraft, { cleanliness: null, accessibility: null, wait_time: null });
  assert.deepEqual(saved, initialContributionsState);
});

test('Cancel while editing restores the saved values rather than submitting or undoing them', () => {
  let state = saveCrowd(initialContributionsState, report(1, userA, 2));
  state = saveBathroom(state, review(2));
  const before = JSON.stringify(state);
  const savedReview = state.bathroomReviews[0];
  const changed = bathroomDraftReducer(bathroomDraftFromSaved(savedReview), { type: 'rate', category: 'wait_time', rating: 1 });
  assert.deepEqual(bathroomDraftReducer(changed, { type: 'cancel', saved: savedReview }), bathroomDraftFromSaved(savedReview));
  assert.equal(crowdDraftReducer(5, { type: 'cancel', saved: state.crowdReports[0].level }), 2);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.bathroomReviews.length, 1);
});

test('contributions are independent of impressions and of each other', () => {
  const impressions = Object.freeze(saveVenueImpression({}, { user_id: userA, bar_id: barA, impression: 'disliked', source: 'demo', updated_at: iso() }));
  const before = JSON.stringify(impressions);
  const bathroom = saveBathroom(initialContributionsState, review(1));
  const both = saveCrowd(bathroom, report(2));
  assert.equal(both.bathroomReviews, bathroom.bathroomReviews);
  assert.equal(JSON.stringify(impressions), before);
  assert.equal(both.bathroomReviews[0].cleanliness, 4);
});

test('invalid reports and incomplete bathroom reviews cannot be committed', () => {
  for (const level of [0, 6, 1.5, NaN]) assert.throws(() => saveCrowd(initialContributionsState, { ...report(1), level }));
  assert.throws(() => saveCrowd(initialContributionsState, { ...report(1), created_at: 'not-a-date' }));
  assert.throws(() => saveCrowd(initialContributionsState, { ...report(1), bar_id: '1' }));
  assert.throws(() => saveBathroom(initialContributionsState, { ...review(1), accessibility: null }));
  assert.throws(() => saveBathroom(initialContributionsState, { ...review(1), wait_time: 6 }));
});
