import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRankings } from '../src/logic/eloRanking.ts';
import { rating, price } from '../src/logic/validation.ts';
test('equal starting ratings transfer 16 points to the winner', () => {
  const rows = calculateRankings([{ id: '1', winner_bar_id: 'a', loser_bar_id: 'b', created_at: '2026-01-01T00:00:00Z' }]);
  assert.deepEqual(rows.map(x => [x.bar_id, x.score]), [['a', 1016], ['b', 984]]);
});
test('rankings have a deterministic replay order and do not mutate input', () => {
  const a = { id: '1', winner_bar_id: 'a', loser_bar_id: 'b', created_at: '2026-01-01T00:00:00Z' };
  const b = { id: '2', winner_bar_id: 'b', loser_bar_id: 'c', created_at: a.created_at };
  const input = [b, a];
  assert.deepEqual(calculateRankings(input), calculateRankings([a, b]));
  assert.equal(input[0], b);
});
test('no comparisons means no invented rankings', () => assert.deepEqual(calculateRankings([]), []));
test('invalid ratings and prices are rejected', () => {
  for (const value of [0, 6, 1.5, NaN, Infinity]) assert.throws(() => rating(value));
  for (const value of [-1, 1.5, NaN, Infinity]) assert.throws(() => price(value));
  assert.equal(rating(5), 5); assert.equal(price(450), 450);
});
