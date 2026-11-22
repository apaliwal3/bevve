import assert from 'node:assert/strict';
import { test } from 'node:test';

// Test-only parity check. No backend module is imported by the mobile runtime.
import { calculateRankings as backendRankings } from '../../bevve-backend/src/logic/eloRanking.ts';
import {
  calculatePersonalRankings, createPersonalComparisonState, ELO_K, INITIAL_ELO,
  pairKey, parseUuid, personalComparisonReducer,
} from '../src/features/comparisons/comparison-state.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';

const ids = mockVenues.map((venue) => venue.id);
const [barA, barB, barC, barD] = ids;
const now = Date.parse('2026-11-15T20:00:00Z');
const id = (number) => 'e98f6a21-fc7c-47dd-a82d-' + number.toString(16).padStart(12, '0');
const comparison = (number, winner = barA, loser = barB, offset = number) => ({
  id: id(number), user_id: SESSION_USER_ID, winner_bar_id: winner, loser_bar_id: loser,
  created_at: new Date(now + offset).toISOString(),
});
const initial = (venues = ids) => createPersonalComparisonState(SESSION_USER_ID, venues);
const castVote = (state, number, winner = state.pair[0], offset = number) => personalComparisonReducer(state, {
  type: 'vote', round: state.round,
  comparison: comparison(number, winner, state.pair.find((venue) => venue !== winner), offset),
});
const advance = (state) => personalComparisonReducer(state, { type: 'advance', round: state.round });
const skip = (state) => personalComparisonReducer(state, { type: 'skip', round: state.round });

test('UUID boundaries normalize case, reject invalid identifiers, and deduplicate the eligible catalog', () => {
  assert.equal(parseUuid(barA.toUpperCase()), barA);
  assert.equal(parseUuid('1'), null);
  assert.equal(parseUuid('Luna Rossa'), null);
  const state = initial([barA, barA.toUpperCase(), '1', barB]);
  assert.deepEqual(state.venueIds, [barA, barB]);
  assert.notEqual(state.pair[0], state.pair[1]);
  assert.throws(() => createPersonalComparisonState('not-a-user', ids));
});

test('Elo matches the agreed 1000 baseline and K=32, with a 16-point initial transfer', () => {
  assert.equal(INITIAL_ELO, 1000);
  assert.equal(ELO_K, 32);
  assert.deepEqual(calculatePersonalRankings([comparison(1)]), [
    { bar_id: barA, score: 1016, comparisons: 1 },
    { bar_id: barB, score: 984, comparisons: 1 },
  ]);
});

test('subsequent Elo changes preserve fractional precision and the total score', () => {
  const history = [comparison(1), comparison(2)];
  const rankings = calculatePersonalRankings(history);
  assert.ok(!Number.isInteger(rankings[0].score));
  assert.ok(Math.abs(rankings[0].score - 1030.5304984710244) < 1e-10);
  assert.ok(Math.abs(rankings.reduce((total, row) => total + row.score, 0) - 2000) < 1e-10);
  assert.deepEqual(rankings, backendRankings(history));
});

test('replay orders comparisons by timestamp then UUID, without mutating history', () => {
  const first = Object.freeze(comparison(1, barA, barB, 0));
  const second = Object.freeze(comparison(2, barC, barA, 0));
  const third = Object.freeze(comparison(3, barB, barC, 1000));
  const shuffled = Object.freeze([third, second, first]);
  assert.deepEqual(calculatePersonalRankings(shuffled), backendRankings([first, second, third]));
  assert.deepEqual(shuffled, [third, second, first]);
  assert.deepEqual(calculatePersonalRankings([]), []);
  assert.throws(() => calculatePersonalRankings([comparison(4, barA, barA)]));
});

test('a longer mixed history exactly matches the existing backend algorithm and comparison counts', () => {
  const history = Array.from({ length: 80 }, (_, index) => {
    const winnerIndex = index % ids.length;
    const loserIndex = (winnerIndex + 1 + Math.floor(index / ids.length) % 3) % ids.length;
    return comparison(index + 1, ids[winnerIndex], ids[loserIndex], Math.floor(index / 3));
  });
  assert.deepEqual(calculatePersonalRankings([...history].reverse()), backendRankings(history));
  assert.equal(calculatePersonalRankings(history).reduce((total, row) => total + row.comparisons, 0), 160);
});

test('voting saves backend-compatible winner/loser UUIDs and recalculates rankings from history', () => {
  const before = initial();
  const after = castVote(before, 1);
  assert.equal(before.history.length, 0);
  assert.equal(after.history.length, 1);
  assert.deepEqual(Object.keys(after.history[0]).sort(), ['id', 'user_id', 'winner_bar_id', 'loser_bar_id', 'created_at'].sort());
  assert.deepEqual(after.history[0], comparison(1, before.pair[0], before.pair[1]));
  assert.deepEqual(after.rankings, calculatePersonalRankings(after.history));
  assert.equal(after.phase, 'feedback');
  assert.deepEqual(after.feedback, { kind: 'vote', winnerId: before.pair[0] });
  assert.deepEqual(after.pair, before.pair);
  const next = advance(after);
  assert.equal(next.phase, 'ready');
  assert.notEqual(pairKey(next.pair), pairKey(before.pair));
  assert.equal(next.history, after.history);
});

test('rapid taps on both venues and Skip save only one comparison for the displayed round', () => {
  const state = initial();
  const first = castVote(state, 1);
  const opposite = comparison(2, state.pair[1], state.pair[0]);
  assert.equal(personalComparisonReducer(first, { type: 'vote', round: state.round, comparison: opposite }), first);
  assert.equal(skip(first), first);
  assert.equal(first.history.length, 1);
  const next = advance(first);
  assert.equal(personalComparisonReducer(next, { type: 'vote', round: state.round, comparison: opposite }), next);
  assert.equal(personalComparisonReducer(next, { type: 'advance', round: state.round }), next);
  assert.equal(next.history.length, 1);
});

test('Skip advances immediately, without a comparison or a ranking change', () => {
  const state = initial();
  const next = skip(state);
  assert.equal(next.round, state.round + 1);
  assert.notEqual(pairKey(next.pair), pairKey(state.pair));
  assert.equal(next.history, state.history);
  assert.equal(next.rankings, state.rankings);
  assert.deepEqual(next.feedback, { kind: 'skip' });
  assert.equal(next.phase, 'ready');
  assert.equal(personalComparisonReducer(next, { type: 'skip', round: state.round }), next);
  assert.equal(personalComparisonReducer(next, { type: 'advance', round: next.round }), next);
});

test('skipping after previous votes retains history and rankings unchanged', () => {
  const voted = advance(castVote(initial(), 1));
  const next = skip(voted);
  assert.equal(next.history, voted.history);
  assert.equal(next.rankings, voted.rankings);
  assert.equal(next.history.length, 1);
});

test('invalid, self, wrong-pair and wrong-user votes cannot be submitted', () => {
  const state = initial();
  for (const fields of [
    { winner_bar_id: barA, loser_bar_id: barA }, { winner_bar_id: barC },
    { loser_bar_id: barD }, { winner_bar_id: '1' }, { id: '1' },
    { user_id: id(999) }, { created_at: 'invalid' },
  ]) {
    assert.equal(personalComparisonReducer(state, {
      type: 'vote', round: state.round, comparison: { ...comparison(1, state.pair[0], state.pair[1]), ...fields },
    }), state);
  }
});

test('a reused submission UUID is rejected even in a later valid round', () => {
  const next = advance(castVote(initial(), 1));
  assert.equal(castVote(next, 1), next);
  assert.equal(next.history.length, 1);
});

test('stored comparison history remains chronological and every ranking is replayed from it', () => {
  const first = castVote(initial(), 1, barA, 5000);
  const ready = advance(first);
  const second = castVote(ready, 2, ready.pair[0], 1000);
  assert.deepEqual(second.history.map((row) => row.id), [id(2), id(1)]);
  assert.deepEqual(second.rankings, backendRankings(second.history));
});

test('every unordered pair gets a turn before repeats, with balanced catalog coverage', () => {
  let state = initial();
  const keys = [];
  const appearances = new Map(ids.map((venue) => [venue, 0]));
  for (let index = 0; index < 6; index++) {
    keys.push(pairKey(state.pair));
    assert.notEqual(state.pair[0], state.pair[1]);
    for (const venue of state.pair) appearances.set(venue, appearances.get(venue) + 1);
    state = skip(state);
  }
  assert.equal(new Set(keys).size, 6);
  assert.deepEqual([...appearances.values()], [3, 3, 3, 3]);
  assert.notEqual(pairKey(state.pair), keys.at(-1));
  assert.equal(state.history.length, 0);
  assert.equal(state.rankings.length, 0);
});

test('pair selection is repeatable, alternates card order, and avoids immediate repeats over multiple cycles', () => {
  let left = initial();
  let right = initial([...ids].reverse());
  for (let index = 0; index < 30; index++) {
    assert.deepEqual(left.pair, right.pair);
    const canonical = [...left.pair].sort();
    assert.deepEqual(left.pair, left.round % 2 === 0 ? canonical : canonical.reverse());
    const previousKey = pairKey(left.pair);
    left = skip(left);
    right = skip(right);
    assert.notEqual(pairKey(left.pair), previousKey);
  }
});

test('empty, single-venue, invalid-only and duplicate-only catalogs have no eligible pair', () => {
  for (const venues of [[], [barA], ['1'], [barA, barA.toUpperCase()]]) {
    const state = initial(venues);
    assert.equal(state.pair, null);
    assert.deepEqual(state.history, []);
    assert.deepEqual(state.rankings, []);
    assert.equal(skip(state), state);
    assert.equal(personalComparisonReducer(state, { type: 'vote', round: 0, comparison: comparison(1) }), state);
  }
});

test('two venues can be compared repeatedly without ever producing a self-pair', () => {
  let state = initial([barA, barB]);
  for (let index = 0; index < 12; index++) {
    assert.notEqual(state.pair[0], state.pair[1]);
    state = advance(castVote(state, index + 1));
  }
  assert.equal(state.history.length, 12);
  assert.ok(state.rankings.every((row) => row.comparisons === 12));
});

test('quick-pick batches never reset comparison history or exclude a venue with no community reviews', () => {
  const fixtureBefore = JSON.stringify(mockVenues);
  let state = initial();
  assert.ok(mockVenues.every((venue) => !('communityRating' in venue)));
  assert.ok(state.venueIds.includes(barD));
  for (let index = 0; index < 15; index++) state = advance(castVote(state, index + 1));
  assert.equal(state.history.length, 15);
  assert.equal(state.round, 15);
  assert.deepEqual(state.rankings, backendRankings(state.history));
  assert.equal(JSON.stringify(mockVenues), fixtureBefore);
});
