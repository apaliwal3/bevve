import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createLanguageStore } from '../src/localization/language-store.ts';
import { createTranslator } from '../src/localization/translation.ts';
import { saveVenueImpression } from '../src/features/impressions/impression-state.ts';
import { contributionsReducer, initialContributionsState, SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';
import { venueExtrasReducer, initialVenueExtrasState } from '../src/features/contributions/venue-extras-state.ts';
import { createPersonalComparisonState, personalComparisonReducer } from '../src/features/comparisons/comparison-state.ts';
import { selectPersonalRankings } from '../src/features/rankings/personal-rankings.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { resolveBarDetailsBack } from '../src/features/venues/bar-details-navigation.ts';
import { priceComparisonHref } from '../src/features/prices/price-navigation.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';

const ids = mockVenues.map((venue) => venue.id);
const barId = ids[0];
const date = '2026-11-15T20:30:00Z';
const id = (number) => 'e98f6a21-fc7c-47dd-a82d-' + number.toString(16).padStart(12, '0');

function voted(state, number) {
  return personalComparisonReducer(state, { type: 'vote', round: state.round, comparison: {
    id: id(number), user_id: SESSION_USER_ID, winner_bar_id: state.pair[0], loser_bar_id: state.pair[1],
    created_at: new Date(Date.parse(date) + number).toISOString(),
  } });
}

test('language subscriptions leave impressions, contribution history, pending/private records and personal rankings intact', async () => {
  const language = createLanguageStore({ persistent: true, getItem: async () => null, setItem: async () => {} });
  await language.initialize();
  let impressions = saveVenueImpression({}, { user_id: SESSION_USER_ID, bar_id: barId, impression: 'liked', source: 'demo', updated_at: date });
  let contributions = contributionsReducer(initialContributionsState, { type: 'submit-crowd', report: {
    id: id(1), bar_id: barId, user_id: SESSION_USER_ID, level: 3, created_at: date,
  } });
  contributions = contributionsReducer(contributions, { type: 'save-bathroom', review: {
    id: id(2), bar_id: barId, user_id: SESSION_USER_ID, cleanliness: 4, accessibility: 3, wait_time: 5, created_at: date, updated_at: date,
  } });
  let extras = venueExtrasReducer(initialVenueExtrasState, { type: 'observe-price', observation: {
    id: id(3), bar_id: barId, drink_id: mockDrinkCatalog[0].id, price_cents: 650, currency: 'EUR', submitted_by: SESSION_USER_ID, observed_at: date,
  } });
  extras = venueExtrasReducer(extras, { type: 'suggest-language', associatedCodes: ['en', 'it'], suggestion: {
    id: id(4), bar_id: barId, language_code: 'fr', suggested_by: SESSION_USER_ID, status: 'pending', created_at: date,
  } });
  extras = venueExtrasReducer(extras, { type: 'report-incident', report: {
    id: id(5), bar_id: barId, reporter_id: SESSION_USER_ID, category: 'Other', description: 'Private demo content',
    occurred_at: null, status: 'pending', created_at: date,
  } });
  let personal = voted(createPersonalComparisonState(SESSION_USER_ID, ids), 6);
  const activity = () => selectProfileContributions({ impressions, ...contributions, priceObservations: extras.priceObservations }, SESSION_USER_ID, mockVenues, mockDrinkCatalog);
  const ranking = () => selectPersonalRankings(personal, mockVenues);
  const baseline = { activity: activity(), ranking: ranking(), impressions, contributions, extras, personal };
  const snapshot = JSON.stringify(baseline);
  let renders = 0;
  const unsubscribe = language.subscribe(() => {
    renders++;
    assert.deepEqual(activity(), baseline.activity);
    assert.deepEqual(ranking(), baseline.ranking);
    assert.equal(JSON.stringify({ activity: activity(), ranking: ranking(), impressions, contributions, extras, personal }), snapshot);
    const t = createTranslator(language.getSnapshot().language);
    assert.equal(t('Profile'), language.getSnapshot().language === 'it' ? 'Profilo' : 'Profile');
  });
  await language.select('it');
  await language.select('en');
  await language.select('it');
  assert.equal(renders, 6);
  unsubscribe();

  // The existing edit/vote/skip contracts still work after changing interface language.
  impressions = saveVenueImpression(impressions, { user_id: SESSION_USER_ID, bar_id: barId, impression: 'disliked', source: 'demo', updated_at: '2026-11-15T20:31:00Z' });
  contributions = contributionsReducer(contributions, { type: 'save-bathroom', review: {
    ...contributions.bathroomReviews[0], cleanliness: 5, updated_at: '2026-11-15T20:31:00Z',
  } });
  personal = personalComparisonReducer(personal, { type: 'advance', round: personal.round });
  personal = personalComparisonReducer(personal, { type: 'skip', round: personal.round });
  assert.equal(personal.history.length, 1);
  personal = voted(personal, 7);
  assert.equal(personal.history.length, 2);
  assert.deepEqual(activity().counts, { impressions: 1, crowdReports: 1, bathroomReviews: 1, priceObservations: 1 });
  assert.equal(activity().impressions[0].impression, 'disliked');
  assert.equal(activity().bathrooms[0].cleanliness, 5);
  assert.ok(!JSON.stringify(activity()).includes('Private demo content'));
  assert.equal(extras.languageSuggestions[0].language_code, 'fr');
});

test('localized back labels preserve route origins, venue UUIDs and selected drinks', () => {
  const t = createTranslator('it');
  const routes = { profile: '/profile', rankings: '/rankings', compare: '/rankings', prices: '/prices' };
  for (const [origin, pathname] of Object.entries(routes)) {
    const plan = resolveBarDetailsBack(origin, mockDrinkCatalog[0].id, barId);
    assert.equal(plan.href.pathname, pathname);
    assert.notEqual(t(plan.label), plan.label);
    if (origin === 'prices') assert.deepEqual(plan.href, priceComparisonHref(mockDrinkCatalog[0].id, barId));
  }
});
