import assert from 'node:assert/strict';
import { test } from 'node:test';

// Test-only parity check; the mobile controller never imports backend code.
import { calculateRankings as backendRankings } from '../../barhop-backend/src/logic/eloRanking.ts';
import {
  calculatePersonalRankings, createPersonalComparisonState, ELO_K, INITIAL_ELO,
} from '../src/features/comparisons/comparison-state.ts';
import {
  createVenueComparisonController, getVenueComparisonPrompt, PROTOTYPE_MAX_VENUE_COMPARISONS,
  selectVenueComparisonOpponents, venueComparisonFlowReducer,
} from '../src/features/comparisons/venue-comparison-flow.ts';
import { saveVenueSentiment, sentimentValues } from '../src/features/sentiments/sentiment-state.ts';
import { selectPersonalRankings } from '../src/features/rankings/personal-rankings.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';

const user = SESSION_USER_ID;
const otherUser = '97c0c196-e3f2-4d15-9c53-81757f652dd2';
const ids = Array.from({ length: 7 }, (_, index) => 'b3eaae75-0317-4411-9814-' + (0x7e7a79f4b001 + index).toString(16));
const [current, barB, barC, barD, barE, barF, barG] = ids;
const flowId = (number) => 'e98f6a21-fc7c-47dd-a82d-' + number.toString(16).padStart(12, '0');
const eventId = (number) => 'ba317246-491e-47f6-8f05-' + number.toString(16).padStart(12, '0');
const time = (offset = 0) => new Date(Date.parse('2026-11-18T20:00:00Z') + offset).toISOString();
const comparison = (number, winner = current, loser = barB, fields = {}) => ({
  id: eventId(number), user_id: user, winner_bar_id: winner, loser_bar_id: loser, created_at: time(number), ...fields,
});
function sentiments(venueIds, owner = user, category = null, state = {}) {
  return venueIds.reduce((saved, barId, index) => saveVenueSentiment(saved, {
    user_id: owner, bar_id: barId, sentiment: category ?? sentimentValues[index % 3], source: 'demo', updated_at: time(),
  }), state);
}
function personal(history = []) {
  return { ...createPersonalComparisonState(user, ids), history, rankings: calculatePersonalRankings(history) };
}
function beginAction(state, saved, fields = {}) {
  return {
    type: 'begin', flowId: flowId(1), expectedFlowId: state.flow?.id ?? null, userId: user,
    currentVenueId: current, intent: 'after-sentiment', sentiments: saved, catalogVenueIds: ids, ...fields,
  };
}
function started(priorIds = ids.slice(1), history = []) {
  const prior = sentiments(priorIds);
  const state = createVenueComparisonController(personal(history), prior);
  return venueComparisonFlowReducer(state, beginAction(state, sentiments([current], user, 'fine', prior)));
}
function voteAction(state, number, winner = current, fields = {}) {
  const prompt = getVenueComparisonPrompt(state);
  assert.ok(prompt);
  const loser = prompt.pair.find((id) => id !== winner);
  return { ...prompt.token, type: 'vote', comparison: comparison(number, winner, loser), ...fields };
}
const skipOne = (state) => venueComparisonFlowReducer(state, { ...getVenueComparisonPrompt(state).token, type: 'skip-one' });
const skipRemaining = (state) => venueComparisonFlowReducer(state, { ...getVenueComparisonPrompt(state).token, type: 'skip-remaining' });
const selection = (saved, history = [], fields = {}) => selectVenueComparisonOpponents({
  userId: user, currentVenueId: current, sentiments: saved, catalogVenueIds: ids, history, ...fields,
});
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('the first experienced venue finishes immediately at contributions with no comparison', () => {
  const state = started([]);
  assert.equal(state.flow.phase, 'contributions');
  assert.equal(state.flow.finishReason, 'no-opponents');
  assert.deepEqual(state.flow.opponentIds, []);
  assert.equal(getVenueComparisonPrompt(state), null);
  assert.deepEqual(state.comparisons.history, []);
  assert.deepEqual(state.comparisons.rankings, []);
});

test('the second venue has exactly one anchored comparison, then finishes', () => {
  const state = started([barB]);
  assert.deepEqual(state.flow.opponentIds, [barB]);
  assert.deepEqual(getVenueComparisonPrompt(state).pair, [current, barB]);
  const action = voteAction(state, 1);
  const next = venueComparisonFlowReducer(state, action);
  assert.equal(next.flow.phase, 'contributions');
  assert.equal(next.flow.finishReason, 'completed');
  assert.equal(getVenueComparisonPrompt(next), null);
  assert.equal(next.comparisons.history.length, 1);
  for (const type of ['vote', 'skip-one', 'skip-remaining']) {
    assert.equal(venueComparisonFlowReducer(next, {
      ...action, type, round: next.flow.round, comparison: comparison(2, barB, current),
    }), next);
  }
});

test('three experienced venues offer two opponents and larger catalogs stop at the prototype maximum of three', () => {
  assert.equal(PROTOTYPE_MAX_VENUE_COMPARISONS, 3);
  assert.equal(started([barB, barC]).flow.opponentIds.length, 2);
  let state = started();
  assert.equal(state.flow.opponentIds.length, 3);
  const seen = new Set();
  for (let round = 0; round < 3; round++) {
    const prompt = getVenueComparisonPrompt(state);
    assert.ok(prompt.pair.includes(current));
    assert.ok(!seen.has(prompt.token.opponentId));
    seen.add(prompt.token.opponentId);
    state = venueComparisonFlowReducer(state, voteAction(state, round + 1, round % 2 ? prompt.token.opponentId : current));
  }
  assert.equal(seen.size, 3);
  assert.equal(state.flow.phase, 'contributions');
  assert.equal(state.comparisons.history.length, 3);
  assert.equal(getVenueComparisonPrompt(state), null);
});

test('liked, fine and disliked establish equal eligibility for the current venue and every opponent', () => {
  for (const category of sentimentValues) {
    const prior = sentiments([barB, barC, barD], user, category);
    const state = createVenueComparisonController(personal(), prior);
    const next = venueComparisonFlowReducer(state, beginAction(state, sentiments([current], user, category, prior)));
    assert.deepEqual(next.flow.opponentIds, [barB, barC, barD]);
  }
});

test('eligibility excludes the current venue, duplicate and invalid UUIDs, absent catalog entries and invalid records', () => {
  const saved = sentiments(ids);
  const malformed = { ...saved, [user]: {
    ...saved[user], invalid: { ...saved[user][barB], bar_id: 'invalid' },
    [barF]: { ...saved[user][barF], user_id: otherUser },
    [barG]: { ...saved[user][barG], sentiment: 'unknown' },
  } };
  const result = selection(malformed, [], {
    catalogVenueIds: [current, current.toUpperCase(), barB, barB.toUpperCase(), barC, barF, barG, 'invalid', '1'],
  });
  assert.deepEqual(result, [barB, barC]);
  assert.equal(new Set(result).size, result.length);
});

test('only sentiments belonging to the flow user establish prior experience', () => {
  const others = sentiments(ids.slice(1), otherUser);
  const saved = sentiments([current], user, 'liked', others);
  assert.deepEqual(selection(saved), []);
  assert.deepEqual(selection(sentiments([barB], user, 'fine', saved)), [barB]);
  assert.deepEqual(selection(sentiments([barC], otherUser, 'fine', saved)), []);
});

test('a saved current sentiment and current catalog membership are required before beginning', () => {
  const state = createVenueComparisonController(personal(), {});
  for (const fields of [
    { sentiments: sentiments([barB]) }, { catalogVenueIds: [barB] },
    { currentVenueId: 'invalid' }, { userId: otherUser }, { flowId: 'invalid' },
    { expectedFlowId: 'invalid' }, { intent: 'automatic-repeat' },
  ]) assert.equal(venueComparisonFlowReducer(state, beginAction(state, sentiments([current, barB]), fields)), state);
  assert.deepEqual(selection(sentiments([barB])), []);
  assert.deepEqual(selection(sentiments(ids), [], { catalogVenueIds: [barB, barC] }), []);
});

test('opponent selection is deterministic across catalog, sentiment insertion and history order', () => {
  const history = [comparison(1, current, barB), comparison(2, barC, current), comparison(3, barD, barE)];
  const expected = selection(sentiments(ids), history);
  assert.deepEqual(expected, [barD, barE, barF]);
  assert.deepEqual(selection(sentiments([...ids].reverse()), [...history].reverse(), { catalogVenueIds: [...ids].reverse() }), expected);
});

test('unplayed opponents come first, followed by the least recently compared using the latest match in either direction', () => {
  const saved = sentiments([current, barB, barC, barD, barE]);
  const history = [
    comparison(1, current, barB, { created_at: time(1) }),
    comparison(2, barB, current, { created_at: time(100) }),
    comparison(3, current, barC, { created_at: time(50) }),
    comparison(4, barD, current, { created_at: time(10) }),
  ];
  assert.deepEqual(selection(saved, history), [barE, barD, barC]);
  // Foreign-user, unrelated-pair and invalid events do not turn an opponent into a played one.
  assert.deepEqual(selection(saved, [
    comparison(10, current, barE, { user_id: otherUser }), comparison(11, barE, barB),
    comparison(12, current, barE, { created_at: 'invalid' }), comparison(13, current, barE, { id: 'invalid' }),
  ]), [barB, barC, barD]);
});

test('equal-time opponent history uses comparison UUID order, then unplayed ties use venue UUID order', () => {
  const saved = sentiments([current, barB, barC, barD]);
  const history = [
    comparison(3, current, barB, { created_at: time() }),
    comparison(1, current, barC, { created_at: '2026-11-18T21:00:00+01:00' }),
    comparison(2, current, barD, { created_at: time() }),
  ];
  assert.deepEqual(selection(saved, history), [barC, barD, barB]);
  assert.deepEqual(selection(saved), [barB, barC, barD]);
});

test('Skip one consumes that opponent without repeating it or changing history and Elo references', () => {
  const state = started([barB, barC, barD], [comparison(1, barC, barD)]);
  const first = getVenueComparisonPrompt(state);
  const next = skipOne(state);
  assert.equal(next.flow.round, 1);
  assert.notEqual(getVenueComparisonPrompt(next).token.opponentId, first.token.opponentId);
  assert.equal(next.comparisons, state.comparisons);
  assert.equal(next.comparisons.history, state.comparisons.history);
  assert.equal(next.comparisons.rankings, state.comparisons.rankings);
  assert.equal(venueComparisonFlowReducer(next, { ...first.token, type: 'skip-one' }), next);
});

test('skipping the only opponent finishes, and Skip remaining preserves earlier votes and Elo', () => {
  assert.equal(skipOne(started([barB])).flow.phase, 'contributions');
  const state = started();
  const voted = venueComparisonFlowReducer(state, voteAction(state, 1));
  const token = getVenueComparisonPrompt(voted).token;
  const next = skipRemaining(voted);
  assert.equal(next.flow.phase, 'contributions');
  assert.equal(next.flow.finishReason, 'skipped-remaining');
  assert.equal(next.comparisons, voted.comparisons);
  assert.equal(next.comparisons.history.length, 1);
  for (const type of ['skip-one', 'skip-remaining', 'vote']) {
    assert.equal(venueComparisonFlowReducer(next, { ...token, type, comparison: comparison(2) }), next);
  }
});

test('all-skipped flows finish without a single comparison or ranking change', () => {
  const state = started();
  let next = state;
  for (let index = 0; index < 3; index++) next = skipOne(next);
  assert.equal(next.flow.phase, 'contributions');
  assert.equal(next.comparisons, state.comparisons);
  assert.deepEqual(next.comparisons.history, []);
  assert.deepEqual(next.comparisons.rankings, []);
  assert.equal(skipRemaining(started()).flow.phase, 'contributions');
});

test('either choice saves exact normalized winner/loser records and preserves the standalone scheduler', () => {
  let state = started([barB, barC]);
  const before = state.comparisons;
  let action = voteAction(state, 1, barB);
  action = { ...action, comparison: Object.fromEntries(Object.entries(action.comparison).map(([key, value]) => [key, value.toUpperCase()])) };
  state = venueComparisonFlowReducer(state, action);
  assert.deepEqual(state.comparisons.history[0], comparison(1, barB, current));
  state = venueComparisonFlowReducer(state, voteAction(state, 2, current));
  assert.deepEqual(state.comparisons.history, [comparison(1, barB, current), comparison(2, current, barC)]);
  assert.deepEqual(Object.keys(state.comparisons.history[0]).sort(), ['id', 'user_id', 'winner_bar_id', 'loser_bar_id', 'created_at'].sort());
  for (const key of ['pair', 'round', 'phase', 'feedback', 'presentations', 'venueIds']) assert.equal(state.comparisons[key], before[key]);
  assert.equal(state.flow.phase, 'contributions');
});

test('rapid taps for either winner, Skip one and Skip remaining cannot save twice for a displayed round', () => {
  const state = started();
  const first = voteAction(state, 1);
  const other = voteAction(state, 2, first.opponentId);
  const next = venueComparisonFlowReducer(state, first);
  for (const action of [first, other, { ...first, type: 'skip-one' }, { ...first, type: 'skip-remaining' }]) {
    assert.equal(venueComparisonFlowReducer(next, action), next);
  }
  assert.equal(next.comparisons.history.length, 1);
});

test('wrong flow, user, venue, opponent or round tokens cannot vote or skip', () => {
  const state = started();
  const action = voteAction(state, 1);
  for (const fields of [
    { flowId: flowId(999) }, { userId: otherUser }, { currentVenueId: barB },
    { opponentId: barG }, { round: 1 }, { round: NaN }, { round: '0' }, { flowId: 'invalid' },
  ]) {
    for (const type of ['vote', 'skip-one', 'skip-remaining']) {
      assert.equal(venueComparisonFlowReducer(state, { ...action, ...fields, type }), state);
    }
  }
});

test('existing event validation rejects self-pairs, wrong participants/users, invalid timestamps and IDs', () => {
  const state = started();
  const action = voteAction(state, 1);
  for (const fields of [
    { user_id: otherUser }, { winner_bar_id: barG }, { loser_bar_id: barG },
    { winner_bar_id: current, loser_bar_id: current }, { id: 'invalid' },
    { winner_bar_id: 'invalid' }, { created_at: 'invalid' },
  ]) assert.equal(venueComparisonFlowReducer(state, { ...action, comparison: { ...action.comparison, ...fields } }), state);
});

test('restarted flows reject old actions even at the same round and reject reused or stale begin identities', () => {
  const state = started();
  const oldVote = voteAction(state, 1);
  const restart = beginAction(state, sentiments(ids), { flowId: flowId(2), intent: 'compare-again' });
  const next = venueComparisonFlowReducer(state, restart);
  assert.equal(next.flow.round, state.flow.round);
  assert.equal(venueComparisonFlowReducer(next, oldVote), next);
  assert.equal(venueComparisonFlowReducer(next, { ...oldVote, type: 'skip-remaining' }), next);
  assert.equal(venueComparisonFlowReducer(next, restart), next);
  assert.equal(venueComparisonFlowReducer(next, { ...restart, flowId: flowId(3) }), next);
  assert.equal(venueComparisonFlowReducer(next, beginAction(next, sentiments(ids), { flowId: flowId(1), intent: 'compare-again' })), next);
  assert.deepEqual(next.comparisons.history, []);
});

test('reopening unchanged or edited sentiments never repeats a flow automatically; Compare again is explicit', () => {
  let state = started([barB]);
  state = venueComparisonFlowReducer(state, voteAction(state, 1));
  let saved = sentiments([current, barB]);
  const history = state.comparisons.history;
  for (const [index, category] of sentimentValues.entries()) {
    saved = sentiments([current], user, category, saved);
    state = venueComparisonFlowReducer(state, beginAction(state, saved, { flowId: flowId(index + 2) }));
    assert.equal(state.flow.phase, 'contributions');
    assert.equal(state.flow.finishReason, 'already-experienced');
    assert.equal(state.comparisons.history, history);
    assert.equal(getVenueComparisonPrompt(state), null);
  }
  const again = venueComparisonFlowReducer(state, beginAction(state, saved, { flowId: flowId(5), intent: 'compare-again' }));
  assert.equal(again.flow.phase, 'comparisons');
  assert.deepEqual(again.flow.opponentIds, [barB]);
  assert.equal(again.comparisons.history, history);
  const duplicate = voteAction(again, 1);
  assert.equal(venueComparisonFlowReducer(again, duplicate), again);
});

test('initializing with existing experience suppresses automatic comparisons, including when its old flow was skipped', () => {
  const saved = sentiments([current, barB]);
  const state = createVenueComparisonController(personal(), saved);
  const reopened = venueComparisonFlowReducer(state, beginAction(state, saved));
  assert.equal(reopened.flow.finishReason, 'already-experienced');
  const skipped = skipRemaining(started([barB]));
  const afterSkip = venueComparisonFlowReducer(skipped, beginAction(skipped, saved, { flowId: flowId(2) }));
  assert.equal(afterSkip.flow.finishReason, 'already-experienced');
  assert.deepEqual(afterSkip.comparisons.history, []);
});

test('reopening a partially answered flow preserves its vote and does not restart remaining prompts', () => {
  const state = started();
  const voted = venueComparisonFlowReducer(state, voteAction(state, 1));
  const reopened = venueComparisonFlowReducer(voted, beginAction(voted, sentiments(ids), { flowId: flowId(2) }));
  assert.equal(reopened.flow.phase, 'contributions');
  assert.equal(reopened.comparisons, voted.comparisons);
  assert.equal(reopened.comparisons.history.length, 1);
});

test('viewing prompts, unknown navigation actions and beginning a flow never count as votes', () => {
  const state = started();
  const before = JSON.stringify(state);
  for (let index = 0; index < 10; index++) {
    const prompt = getVenueComparisonPrompt(state);
    assert.equal(venueComparisonFlowReducer(state, { ...prompt.token, type: 'view-venue' }), state);
  }
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.comparisons.history.length, 0);
});

test('canonical UUID normalization also applies to flow identities, tokens and user/venue input', () => {
  const prior = sentiments([barB]);
  const state = createVenueComparisonController(personal(), prior);
  const action = beginAction(state, sentiments([current], user, 'liked', prior));
  for (const key of ['flowId', 'userId', 'currentVenueId']) action[key] = action[key].toUpperCase();
  const begun = venueComparisonFlowReducer(state, action);
  assert.equal(begun.flow.id, flowId(1));
  const vote = voteAction(begun, 1);
  for (const key of ['flowId', 'userId', 'currentVenueId', 'opponentId']) vote[key] = vote[key].toUpperCase();
  assert.equal(venueComparisonFlowReducer(begun, vote).comparisons.history.length, 1);
});

test('votes preserve history and exact backend Elo parity, replay ordering, constants and ordinal projection across batches', () => {
  const history = [comparison(1, barB, barC, { created_at: time(1000) }), comparison(2, barD, barE, { created_at: time() })];
  const original = JSON.stringify(history);
  let state = started(ids.slice(1), history);
  let sequence = 100;
  const venues = ids.map((id, index) => ({ ...mockVenues[0], id, name: 'Venue ' + index }));
  for (let batch = 0; batch < 6; batch++) {
    if (batch > 0) state = venueComparisonFlowReducer(state, beginAction(state, sentiments(ids), { flowId: flowId(batch + 1), intent: 'compare-again' }));
    while (getVenueComparisonPrompt(state)) {
      const prompt = getVenueComparisonPrompt(state);
      const action = voteAction(state, sequence++, sequence % 2 ? current : prompt.token.opponentId);
      action.comparison.created_at = time(500); // Same-time UUID tie ordering, before an existing later event.
      state = venueComparisonFlowReducer(state, action);
      assert.deepEqual(state.comparisons.rankings, backendRankings(state.comparisons.history));
      assert.deepEqual(state.comparisons.history, [...state.comparisons.history].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)));
      const projected = selectPersonalRankings(state.comparisons, venues);
      assert.deepEqual(projected.entries.map((entry) => entry.position), projected.entries.map((_, index) => index + 1));
      assert.ok(projected.entries.every((entry) => !('score' in entry) && !('elo' in entry)));
    }
  }
  assert.equal(state.comparisons.history.length, history.length + 18);
  assert.equal(JSON.stringify(history), original);
  assert.equal(INITIAL_ELO, 1000);
  assert.equal(ELO_K, 32);
});

test('frozen controller, sentiment and catalog inputs remain unchanged when starting, voting and skipping', () => {
  const prior = freeze(sentiments([barB, barC]));
  const saved = freeze(sentiments([current], user, 'liked', prior));
  const state = freeze(createVenueComparisonController(personal([comparison(1, barB, barC)]), prior));
  const catalog = freeze([...ids]);
  const before = JSON.stringify({ state, prior, saved, catalog });
  const begun = freeze(venueComparisonFlowReducer(state, beginAction(state, saved, { catalogVenueIds: catalog })));
  const voted = freeze(venueComparisonFlowReducer(begun, voteAction(begun, 2)));
  const skipped = skipRemaining(voted);
  assert.equal(skipped.flow.phase, 'contributions');
  assert.equal(JSON.stringify({ state, prior, saved, catalog }), before);
});
