import assert from 'node:assert/strict';
import { test } from 'node:test';

import { filterVenues } from '../src/features/explore/filter-venues.ts';
import { selectVenueCrowd } from '../src/features/explore/venue-crowd.ts';
import { CROWD_WINDOW_MS, SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';

const basso = mockVenues[1];
const now = Date.parse('2026-11-16T21:00:00Z');
const id = (value) => 'e98f6a21-fc7c-47dd-a82d-' + value.toString(16).padStart(12, '0');
const report = (value, level, user = SESSION_USER_ID, age = 0, barId = basso.id) => ({
  id: id(value), bar_id: barId, user_id: user, level, created_at: new Date(now - age).toISOString(),
});
const crowdFor = (reports, time = now) => (venue) => selectVenueCrowd(venue, reports, time);
const isListed = (reports, time = now) => filterVenues(mockVenues, '', 'Quiet', crowdFor(reports, time)).some((venue) => venue.id === basso.id);

test('Quiet preserves labeled demo snapshots when that venue has no session reports', () => {
  assert.deepEqual(selectVenueCrowd(basso, [], now), { source: 'demo', level: 2, label: 'Easygoing', isQuiet: true });
  assert.equal(isListed([]), true);
  assert.equal(isListed([report(1, 5, SESSION_USER_ID, 0, mockVenues[0].id)]), true);
  const missing = selectVenueCrowd(mockVenues[3], [], now);
  assert.equal(missing.level, null);
  assert.equal(missing.isQuiet, false);
});

test('a Packed session report removes Basso from Quiet when its card crowd becomes insufficient', () => {
  const reports = [report(1, 5)];
  assert.deepEqual(selectVenueCrowd(basso, reports, now), { source: 'session', level: null, label: null, isQuiet: false });
  assert.equal(isListed(reports), false);
  assert.equal(isListed([report(1, 1)]), false, 'One quiet report cannot establish a classification either.');
});

test('Quiet follows backend classifications rather than treating a moderate average of 2 as quiet', () => {
  for (const [levels, label, included] of [
    [[1, 1, 2], 'Quiet', true],
    [[2, 2, 2], 'Moderate', false],
    [[5, 5, 5], 'Busy', false],
  ]) {
    const reports = levels.map((level, index) => report(index + 1, level, id(100 + index)));
    const crowd = selectVenueCrowd(basso, reports, now);
    assert.equal(crowd.label, label);
    assert.equal(crowd.level, levels.reduce((sum, level) => sum + level, 0) / 3);
    assert.equal(isListed(reports), included);
  }
});

test('latest-per-contributor, three-contributor minimum and future exclusion apply to filtering', () => {
  assert.equal(isListed([report(1, 1), report(2, 1), report(3, 1)]), false);
  const reports = [report(1, 1, id(101), 1000), report(2, 1, id(102)), report(3, 1, id(103))];
  assert.equal(isListed(reports), true);
  assert.equal(isListed([...reports, report(4, 5, id(101))]), false, 'A newer report replaces that contributor’s older level.');
  assert.equal(isListed([report(1, 1, id(101)), report(2, 1, id(102)), report(3, 1, id(103), -1)]), false);
});

test('the 45-minute boundary stays inclusive and expired session data never revives the quiet demo level', () => {
  const reports = [101, 102, 103].map((user, index) => report(index + 1, 1, id(user), CROWD_WINDOW_MS));
  assert.equal(isListed(reports), true);
  assert.equal(isListed(reports, now + 1), false);
  assert.deepEqual(selectVenueCrowd(basso, reports, now + 1), { source: 'session', level: null, label: null, isQuiet: false });
});

test('crowd selection leaves search, other filters, fixtures and report history unchanged', () => {
  const reports = [report(1, 5)];
  const before = JSON.stringify({ venues: mockVenues, reports });
  for (const filter of ['All', 'Nearby', 'Cheap', 'Popular']) {
    assert.deepEqual(filterVenues(mockVenues, '', filter, crowdFor(reports)), filterVenues(mockVenues, '', filter));
  }
  assert.deepEqual(filterVenues(mockVenues, 'Navigli', 'Quiet', crowdFor(reports)), []);
  assert.equal(filterVenues(mockVenues, ' PORTA VENEZIA ', 'All', crowdFor(reports))[0].id, basso.id);
  assert.equal(JSON.stringify({ venues: mockVenues, reports }), before);
});
