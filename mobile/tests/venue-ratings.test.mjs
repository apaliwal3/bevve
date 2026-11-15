import assert from 'node:assert/strict';
import { test } from 'node:test';

import { communityRatingWithUser, venueRatingsReducer } from '../src/features/ratings/rating-state.ts';

const firstId = 'b3eaae75-0317-4411-9814-7e7a79f4b001';
const secondId = 'b3eaae75-0317-4411-9814-7e7a79f4b004';

test('an unrated venue keeps its community baseline without a contribution', () => {
  const baseline = Object.freeze({ average: 4.7, count: 86 });
  assert.equal(communityRatingWithUser(baseline, null), baseline);
  assert.equal(communityRatingWithUser(null, null), null);
});

test('the first rating contributes once; edits replace that contribution', () => {
  const baseline = Object.freeze({ average: 4, count: 10 });
  let ratings = venueRatingsReducer({}, { venueId: firstId, rating: 5 });
  const first = communityRatingWithUser(baseline, ratings[firstId]);
  assert.equal(first.count, 11);
  assert.equal(first.average, 45 / 11);

  // Repeated edits must not change the count or accumulate rounding errors.
  for (let edit = 0; edit < 100; edit += 1) {
    ratings = venueRatingsReducer(ratings, { venueId: firstId, rating: (edit % 5) + 1 });
  }
  const edited = communityRatingWithUser(baseline, ratings[firstId]);
  assert.equal(edited.count, 11);
  assert.equal(edited.average, 45 / 11);
  assert.deepEqual(baseline, { average: 4, count: 10 });
});

test('a venue with no previous ratings has count one even after editing', () => {
  let ratings = venueRatingsReducer({}, { venueId: secondId, rating: 4 });
  assert.deepEqual(communityRatingWithUser(null, ratings[secondId]), { average: 4, count: 1 });
  ratings = venueRatingsReducer(ratings, { venueId: secondId, rating: 2 });
  assert.deepEqual(communityRatingWithUser(null, ratings[secondId]), { average: 2, count: 1 });
});

test('UUID-keyed ratings stay independent, normalize case, and do not mutate prior state', () => {
  const previous = Object.freeze({ [firstId]: 3 });
  const ratings = venueRatingsReducer(previous, { venueId: secondId.toUpperCase(), rating: 5 });
  assert.deepEqual(previous, { [firstId]: 3 });
  assert.deepEqual(ratings, { [firstId]: 3, [secondId]: 5 });
  assert.equal(venueRatingsReducer(ratings, { venueId: secondId, rating: 5 }), ratings);
});

test('invalid scores and identifiers cannot create a rating', () => {
  const previous = Object.freeze({});
  for (const rating of [0, 6, 1.5, NaN, Infinity, '5', null]) {
    assert.throws(() => venueRatingsReducer(previous, { venueId: firstId, rating }));
  }
  for (const venueId of ['', '1', 'not-a-uuid']) {
    assert.throws(() => venueRatingsReducer(previous, { venueId, rating: 4 }));
  }
  assert.deepEqual(previous, {});
});
