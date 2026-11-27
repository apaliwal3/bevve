import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createRatingJourneyState, getRatingJourneyView, ratingJourneyReducer } from '../src/features/ratings/rating-journey-state.ts';
import { calculatePersonalRankings } from '../src/features/comparisons/comparison-state.ts';
import { selectPersonalRankings } from '../src/features/rankings/personal-rankings.ts';
import { createLanguageStore } from '../src/localization/language-store.ts';
import { SESSION_USER_ID, initialContributionsState, contributionsReducer } from '../src/features/contributions/contribution-state.ts';
import { initialVenueExtrasState } from '../src/features/contributions/venue-extras-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { calculateRankings as backendRankings } from '../../bevve-backend/src/logic/eloRanking.ts';

const ids = mockVenues.map((venue) => venue.id);
const [a, b, c, d] = ids;
const id = (n) => 'e98f6a21-fc7c-47dd-a82d-' + n.toString(16).padStart(12, '0');
const at = '2026-11-18T20:00:00Z';
const initial = () => createRatingJourneyState(SESSION_USER_ID, ids);
const view = (state, bar = state.overlay?.barId ?? a) => getRatingJourneyView(state, bar);
const open = (state, bar, n) => ratingJourneyReducer(state, { type: 'open', barId: bar, overlayId: id(n) });
const close = (state) => ratingJourneyReducer(state, { type: 'close', overlayId: state.overlay.id });
const saveAction = (state, n, impression = 'liked', resume = true) => ({ ...view(state).token, type: 'save-impression', impression, resume, at, flowId: id(n) });
const save = (state, n, impression = 'liked', resume = true) => ratingJourneyReducer(state, saveAction(state, n, impression, resume));
const revisitAction = (state, intent) => ({ ...view(state).token, type: 'revisit', intent, userId: SESSION_USER_ID, expectedFlowId: view(state).flowId });
const againAction = (state, n) => ({ ...view(state).token, type: 'compare-again', userId: SESSION_USER_ID, expectedFlowId: view(state).flowId, flowId: id(n) });
function flowAction(state, type = 'vote', n = 900, winner) {
  const current = view(state);
  const chosen = winner ?? current.prompt.pair[0];
  return { ...current.token, type: 'flow', action: {
    ...current.prompt.token, type,
    ...(type === 'vote' ? { comparison: {
      id: id(n), user_id: SESSION_USER_ID, winner_bar_id: chosen,
      loser_bar_id: current.prompt.pair.find((venue) => venue !== chosen), created_at: at,
    } } : {}),
  } };
}
function experience(state, bar, n) {
  state = save(open(state, bar, n), n + 1);
  if (view(state).step === 'comparisons') state = ratingJourneyReducer(state, flowAction(state, 'skip-remaining'));
  return close(state);
}

test('opening, selecting an unsaved draft and closing cannot create impression, comparisons or forms', () => {
  const start = initial();
  const opened = open(start, a, 1);
  assert.equal(view(opened).step, 'impression');
  assert.equal(view(opened).impression, null);
  const closed = close(opened);
  assert.deepEqual(closed.impressions, {});
  assert.equal(closed.comparisons.history, start.comparisons.history);
  assert.ok(!('contributions' in closed));
  assert.equal(view(opened).prompt, null);
});

test('first saved impression goes straight to the five optional contributions without Elo', () => {
  const opened = open(initial(), a, 1);
  const saved = save(opened, 2, 'fine');
  assert.equal(view(saved).step, 'contributions');
  assert.equal(view(saved).impression, 'fine');
  assert.equal(saved.impressions[SESSION_USER_ID][a].source, 'demo');
  assert.equal(saved.comparisons.history, opened.comparisons.history);
  assert.equal(saved.comparisons.rankings, opened.comparisons.rankings);
});

test('second venue offers one comparison; the fourth offers exactly three and finishes', () => {
  let state = experience(initial(), a, 1);
  state = save(open(state, b, 3), 4, 'disliked');
  assert.deepEqual(view(state).progress, { current: 1, total: 1 });
  assert.deepEqual(new Set(view(state).prompt.pair), new Set([a, b]));
  state = close(ratingJourneyReducer(state, flowAction(state, 'skip-one')));
  state = experience(state, c, 5);
  state = save(open(state, d, 7), 8);
  assert.deepEqual(view(state).progress, { current: 1, total: 3 });
  for (let round = 0; round < 3; round++) {
    assert.equal(view(state).progress.current, round + 1);
    state = ratingJourneyReducer(state, flowAction(state, 'vote', 100 + round));
  }
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.comparisons.history.length, 3);
  assert.equal(view(state).prompt, null);
});

test('rapid saves, duplicate votes and queued skip actions consume at most one displayed round', () => {
  let state = open(experience(initial(), a, 1), b, 3);
  const firstSave = saveAction(state, 4);
  state = ratingJourneyReducer(state, firstSave);
  assert.equal(ratingJourneyReducer(state, firstSave), state);
  const vote = flowAction(state);
  const skipped = { ...vote, action: { ...vote.action, type: 'skip-remaining' } };
  const voted = ratingJourneyReducer(state, vote);
  assert.equal(ratingJourneyReducer(voted, vote), voted);
  assert.equal(ratingJourneyReducer(voted, skipped), voted);
  assert.equal(voted.comparisons.history.length, 1);
  assert.equal(Object.keys(voted.impressions[SESSION_USER_ID]).length, 2);
});

test('dismissal retains unfinished progress; reopening explicitly resumes the next unconsumed opponent', () => {
  let state = initial();
  for (const [index, bar] of [a, b, c].entries()) state = experience(state, bar, index * 2 + 1);
  state = save(open(state, d, 7), 8);
  const first = flowAction(state, 'vote', 100);
  state = ratingJourneyReducer(state, first);
  const pending = state.flows[d];
  const history = state.comparisons.history;
  const stale = flowAction(state, 'vote', 101);
  const closed = close(state);
  assert.equal(ratingJourneyReducer(closed, stale), closed);
  state = open(closed, d, 9);
  assert.equal(view(state).step, 'impression');
  assert.equal(view(state).pending, true);
  assert.equal(view(state).impression, 'liked');
  assert.equal(view(state).prompt, null);
  state = save(state, 10, 'liked', true);
  assert.equal(state.flows[d], pending);
  assert.deepEqual(view(state).progress, { current: 2, total: 3 });
  assert.equal(state.comparisons.history, history);
  assert.equal(ratingJourneyReducer(state, first), state);
  assert.equal(ratingJourneyReducer(state, stale), state); // Old overlay lease, same pending round.
  state = ratingJourneyReducer(state, flowAction(state, 'vote', 102));
  assert.equal(state.comparisons.history.length, 2);
});

test('users may save an edit and go to optional forms while retaining a later explicit resume', () => {
  let state = save(open(experience(initial(), a, 1), b, 3), 4);
  const pending = state.flows[b];
  state = open(close(state), b, 5);
  state = save(state, 6, 'disliked', false);
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.flows[b], pending);
  state = save(open(close(state), b, 7), 8, 'fine', true);
  assert.equal(view(state).step, 'comparisons');
  assert.equal(view(state).impression, 'fine');
  assert.equal(state.flows[b], pending);
  assert.deepEqual(state.comparisons.history, []);
});

test('completed and skipped flows never restart when unchanged or edited impression is saved', () => {
  let state = save(open(experience(initial(), a, 1), b, 3), 4);
  state = ratingJourneyReducer(state, flowAction(state, 'vote', 100));
  const history = state.comparisons.history;
  const rankings = state.comparisons.rankings;
  for (const [index, impression] of ['liked', 'fine', 'disliked'].entries()) {
    state = save(open(close(state), b, 5 + index * 2), 6 + index * 2, impression);
    assert.equal(view(state).step, 'contributions');
    assert.equal(view(state).pending, false);
    assert.equal(state.comparisons.history, history);
    assert.equal(state.comparisons.rankings, rankings);
    assert.equal(Object.keys(state.impressions[SESSION_USER_ID]).length, 2);
  }
});

test('Skip all, dismiss and reopen only starts a new batch after an explicit Compare again, without resaving impression or voting', () => {
  let state = experience(experience(initial(), a, 1), b, 3);
  const oldFlow = state.flows[b];
  const impressions = state.impressions;
  state = open(state, b, 5);
  assert.equal(view(state).canCompareAgain, true);
  assert.equal(view(state).step, 'impression');
  assert.equal(state.flows[b], oldFlow);
  const comparisons = state.comparisons;
  const action = againAction(state, 6);
  state = ratingJourneyReducer(state, action);
  assert.equal(view(state).step, 'comparisons');
  assert.notEqual(state.flows[b].id, oldFlow.id);
  assert.equal(state.impressions, impressions);
  assert.equal(state.comparisons, comparisons);
  assert.deepEqual(view(state).prompt.pair, [b, a]);
  assert.equal(ratingJourneyReducer(state, action), state);
  assert.equal(state.comparisons.history.length, 0);
});

test('a new explicit batch prefers unplayed opponents, reuses previously played ones and retains exact Elo across at most three distinct opponents', () => {
  let state = initial();
  for (const [index, bar] of [a, b, c].entries()) state = experience(state, bar, index * 2 + 1);
  state = save(open(state, d, 7), 8);
  const played = view(state).prompt.token.opponentId;
  const oldVote = flowAction(state, 'vote', 100, d);
  state = ratingJourneyReducer(state, oldVote);
  state = ratingJourneyReducer(state, flowAction(state, 'skip-remaining'));
  state = open(close(state), d, 9);
  const history = state.comparisons.history, rankings = state.comparisons.rankings, impressions = state.impressions;
  state = ratingJourneyReducer(state, againAction(state, 10));
  assert.equal(state.comparisons.history, history);
  assert.equal(state.comparisons.rankings, rankings);
  assert.equal(state.impressions, impressions);
  assert.equal(state.flows[d].opponentIds.length, 3);
  assert.equal(state.flows[d].opponentIds[2], played);
  const opponents = new Set();
  for (let round = 0; round < 3; round++) {
    assert.equal(ratingJourneyReducer(state, oldVote), state);
    assert.ok(view(state).prompt.pair.includes(d));
    opponents.add(view(state).prompt.token.opponentId);
    state = ratingJourneyReducer(state, flowAction(state, 'vote', 200 + round, d));
  }
  assert.equal(opponents.size, 3);
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.comparisons.history.length, 4);
  assert.deepEqual(state.comparisons.rankings, backendRankings(state.comparisons.history));
});

test('Resume and Continue to contributions preserve saved impressions, pending flow identity and every recorded vote', () => {
  let state = initial();
  for (const [index, bar] of [a, b, c].entries()) state = experience(state, bar, index * 2 + 1);
  state = save(open(state, d, 7), 8);
  state = ratingJourneyReducer(state, flowAction(state, 'vote', 100));
  state = open(close(state), d, 9);
  const flow = state.flows[d], impressions = state.impressions, history = state.comparisons.history;
  assert.equal(view(state).canCompareAgain, false);
  assert.equal(ratingJourneyReducer(state, againAction(state, 10)), state);
  state = ratingJourneyReducer(state, revisitAction(state, 'contributions'));
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.flows[d], flow);
  state = open(close(state), d, 11);
  state = ratingJourneyReducer(state, revisitAction(state, 'resume'));
  assert.equal(state.flows[d], flow);
  assert.equal(state.impressions, impressions);
  assert.equal(state.comparisons.history, history);
  assert.deepEqual(view(state).progress, { current: 2, total: 3 });
});

test('revisit guards reject wrong users, venues, previous flow IDs, reused new IDs and stale catalog or overlay callbacks', () => {
  let state = open(experience(experience(initial(), a, 1), b, 3), b, 5);
  const action = againAction(state, 6);
  for (const fields of [
    { userId: id(99) }, { barId: a }, { expectedFlowId: null }, { expectedFlowId: 'invalid' },
    { flowId: state.flows[b].id }, { flowId: 'invalid' }, { overlayId: id(99) }, { catalogRevision: -1 },
  ]) assert.equal(ratingJourneyReducer(state, { ...action, ...fields }), state);
  const reopened = open(close(state), b, 7);
  assert.equal(ratingJourneyReducer(reopened, action), reopened);
  const changed = ratingJourneyReducer(state, { type: 'catalog', venueIds: [b] });
  assert.equal(ratingJourneyReducer(changed, action), changed);
  assert.equal(view(changed).canCompareAgain, false);
  assert.equal(view(changed).noOpponents, true);
  state = ratingJourneyReducer(changed, revisitAction(changed, 'contributions'));
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.comparisons.history.length, 0);
  assert.equal(ratingJourneyReducer(state, againAction(state, 8)), state);
  const fresh = open(initial(), a, 1);
  assert.equal(ratingJourneyReducer(fresh, againAction(fresh, 2)), fresh);
});

test('progress survives opening another venue, and stale callbacks/cleanup cannot change the newer overlay', () => {
  let state = save(open(experience(initial(), a, 1), b, 3), 4);
  const stale = flowAction(state);
  const oldLease = state.overlay.id;
  const pending = state.flows[b];
  state = open(state, c, 5);
  assert.equal(ratingJourneyReducer(state, stale), state);
  assert.equal(ratingJourneyReducer(state, { type: 'close', overlayId: oldLease }), state);
  assert.equal(ratingJourneyReducer(state, { type: 'open', overlayId: oldLease, barId: b }), state);
  state = save(open(close(state), b, 6), 7);
  assert.equal(state.flows[b], pending);
  assert.equal(view(state).step, 'comparisons');
});

test('two unfinished venue journeys retain separate progress while sharing every completed vote', () => {
  let state = save(open(experience(initial(), a, 1), b, 3), 4);
  const pendingB = state.flows[b];
  state = save(open(close(state), c, 5), 6);
  state = ratingJourneyReducer(state, flowAction(state, 'vote', 100));
  const pendingC = state.flows[c];
  state = save(open(close(state), b, 7), 8);
  assert.equal(state.flows[b], pendingB);
  state = ratingJourneyReducer(state, flowAction(state, 'vote', 101));
  assert.equal(state.comparisons.history.length, 2);
  state = save(open(close(state), c, 9), 10);
  assert.equal(state.flows[c], pendingC);
  assert.deepEqual(view(state).progress, { current: 2, total: 2 });
  state = ratingJourneyReducer(state, flowAction(state, 'skip-one'));
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.comparisons.history.length, 2);
  assert.deepEqual(state.comparisons.rankings, backendRankings(state.comparisons.history));
});

test('catalog changes remove missing opponents, invalidate captured actions and retain existing votes', () => {
  let state = experience(initial(), a, 1);
  state = experience(state, b, 3);
  state = save(open(state, c, 5), 6);
  const stale = flowAction(state);
  const removed = view(state).prompt.token.opponentId;
  state = ratingJourneyReducer(state, { type: 'catalog', venueIds: ids.filter((bar) => bar !== removed) });
  assert.equal(ratingJourneyReducer(state, stale), state);
  assert.ok(!view(state).prompt.pair.includes(removed));
  const vote = flowAction(state);
  state = ratingJourneyReducer(state, vote);
  const history = state.comparisons.history;
  state = ratingJourneyReducer(state, { type: 'catalog', venueIds: [c] });
  assert.equal(view(state).step, 'contributions');
  assert.equal(state.comparisons.history, history);
  assert.deepEqual(state.comparisons.rankings, backendRankings(history));
});

test('removing the current venue revokes the overlay and keeps its impression and pending progress', () => {
  let state = save(open(experience(initial(), a, 1), b, 3), 4);
  const pending = state.flows[b];
  const stale = flowAction(state);
  state = ratingJourneyReducer(state, { type: 'catalog', venueIds: [a] });
  assert.equal(state.overlay, null);
  assert.equal(state.flows[b], pending);
  assert.equal(state.impressions[SESSION_USER_ID][b].impression, 'liked');
  assert.equal(ratingJourneyReducer(state, stale), state);
  state = ratingJourneyReducer(state, { type: 'catalog', venueIds: ids });
  state = save(open(state, b, 5), 6);
  assert.equal(view(state).step, 'comparisons');
});

test('catalog normalization is idempotent and an unchanged catalog does not invalidate progress', () => {
  const state = save(open(experience(initial(), a, 1), b, 3), 4);
  const same = ratingJourneyReducer(state, { type: 'catalog', venueIds: [...ids].reverse().map((bar) => bar.toUpperCase()).concat('invalid', a) });
  assert.equal(same, state);
});

test('legacy Compare and the overlay append to one history, retain exact Elo parity and ordinal projections', () => {
  let state = initial();
  const legacy = (state, n) => ({ type: 'legacy', action: { type: 'vote', round: state.comparisons.round, comparison: {
    id: id(n), user_id: SESSION_USER_ID, winner_bar_id: state.comparisons.pair[0], loser_bar_id: state.comparisons.pair[1], created_at: at,
  } } });
  state = ratingJourneyReducer(state, legacy(state, 100));
  const queuedAdvance = { type: 'legacy', action: { type: 'advance', round: state.comparisons.round } };
  state = experience(state, a, 1);
  assert.equal(ratingJourneyReducer(state, queuedAdvance), state);
  state = save(open(state, b, 3), 4);
  assert.equal(ratingJourneyReducer(state, legacy(state, 101)), state);
  state = ratingJourneyReducer(state, flowAction(state, 'vote', 102));
  state = close(state);
  state = ratingJourneyReducer(state, legacy(state, 103));
  assert.equal(state.comparisons.history.length, 3);
  assert.deepEqual(state.comparisons.rankings, backendRankings(state.comparisons.history));
  assert.deepEqual(state.comparisons.rankings, calculatePersonalRankings(state.comparisons.history));
  const projection = selectPersonalRankings(state.comparisons, mockVenues);
  assert.equal(projection.completedCount, 3);
  assert.deepEqual(projection.entries.map((entry) => entry.position), projection.entries.map((_, index) => index + 1));
  assert.ok(projection.entries.every((entry) => !('score' in entry)));
});

test('impression/comparison steps do not submit optional forms or touch contribution and price state', () => {
  const contributions = contributionsReducer(initialContributionsState, { type: 'submit-crowd', report: {
    id: id(600), bar_id: a, user_id: SESSION_USER_ID, level: 3, created_at: at,
  } });
  const before = JSON.stringify({ contributions, extras: initialVenueExtrasState });
  let state = save(open(experience(initial(), a, 1), b, 3), 4, 'fine');
  state = ratingJourneyReducer(state, flowAction(state, 'skip-remaining'));
  state = close(state);
  assert.equal(JSON.stringify({ contributions, extras: initialVenueExtrasState }), before);
  assert.equal(state.comparisons.history.length, 0);
  assert.ok(!('extras' in state) && !('contributions' in state));
});

test('English/Italian preference changes cannot reset saved impressions, shared Elo or pending progress', async () => {
  const state = save(open(experience(initial(), a, 1), b, 3), 4);
  const before = JSON.stringify(state);
  const writes = [];
  const language = createLanguageStore({ persistent: true, getItem: async () => null, setItem: async (key, value) => writes.push([key, value]) });
  await language.initialize();
  await language.select('it');
  await language.select('en');
  assert.equal(JSON.stringify(state), before);
  assert.equal(view(state).pending, true);
  assert.equal(writes.length, 2);
  assert.ok(writes.every(([key]) => key === 'bevve.interface-language.v1'));
});
