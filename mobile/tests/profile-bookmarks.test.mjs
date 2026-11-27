import assert from 'node:assert/strict';
import { test } from 'node:test';
import { elements, loadNativeModule } from './helpers/native-module.mjs';
import { profileUi } from './helpers/profile-ui.mjs';
import { createSavedBarsStore } from '../src/features/saved-bars/saved-bars-store.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { saveVenueImpression } from '../src/features/impressions/impression-state.ts';
import { SESSION_USER_ID as owner } from '../src/features/contributions/contribution-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { venueFromWantToTryHref, resolveBarDetailsBack, navigateBackFromBarDetails } from '../src/features/venues/bar-details-navigation.ts';
const [venue, second] = mockVenues;
const at = '2026-11-27T18:00:00Z';
const row = id => ({ user_id: owner, bar_id: id, created_at: at });
const tick = () => new Promise(resolve => setImmediate(resolve));
const activity = impressions => selectProfileContributions({ impressions, crowdReports: [], bathroomReviews: [], priceObservations: [] }, owner, mockVenues, []);
function expand(tree) {
  return [...elements(tree)].flatMap(node => typeof node.type === 'function' ? expand(node.type(node.props)) : [node]);
}
function savedScreen(ui, props = {}) {
  const module = loadNativeModule('src/features/profile/want-to-try-screen.tsx', ui.mocks);
  return module.WantToTryScreen({ venues: mockVenues, ...props });
}
function stats(ui, impressions = {}) {
  const tree = ui.render({ activity: activity(impressions), onOpenVenue() {}, onWelcome() {} });
  return expand(tree.props.header).filter(node => node.type === 'Pressable').map(node => node.props.accessibilityLabel);
}

test('Profile bookmark count uses confirmed saves and remains independent of Places Been', async () => {
  let resolve;
  const store = createSavedBarsStore(owner, { load: async () => [], setSaved: () => new Promise(done => { resolve = done; }) });
  const stop = store.start(); await tick();
  const ui = profileUi();
  const sync = () => Object.assign(ui.savedBars, store.getSnapshot(), { refresh: store.refresh, setSaved: store.setSaved });
  const unsubscribe = store.subscribe(sync); sync();
  const impressions = saveVenueImpression({}, { user_id: owner, bar_id: venue.id, impression: 'liked', source: 'demo', updated_at: at });
  assert.ok(stats(ui, impressions).includes('Places Been. 1'));
  const saving = store.setSaved(venue.id, true); await tick();
  assert.ok(stats(ui, impressions).includes('Want to Try. 0'));
  resolve(row(venue.id)); await saving;
  assert.ok(stats(ui, impressions).includes('Want to Try. 1'));
  assert.ok(stats(ui, impressions).includes('Places Been. 1'));
  const edited = saveVenueImpression(impressions, { user_id: owner, bar_id: venue.id, impression: 'disliked', source: 'demo', updated_at: '2026-11-27T18:01:00Z' });
  assert.ok(stats(ui, edited).includes('Want to Try. 1'));
  unsubscribe(); stop();
});

test('Want to Try uses existing saved records, contextual venue links, real saved dates and sibling removal controls', () => {
  const ui = profileUi('en', { savedBars: { bars: { [venue.id]: row(venue.id), [second.id]: { ...row(second.id), created_at: '2026-11-27T18:01:00Z' } } } });
  const tree = savedScreen(ui);
  assert.equal(tree.type, 'ProfileList'); assert.equal(tree.props.secondary, true);
  assert.deepEqual(Array.from(tree.props.data, item => item.bar_id), [second.id, venue.id]);
  const nodes = [...elements(tree.props.renderItem({ item: tree.props.data[0] }))];
  const link = nodes.find(node => node.type === ui.rows.ProfileActivityRow);
  const remove = nodes.find(node => node.type === 'BookmarkButton');
  assert.equal(link.props.summary, ui.t('Saved {date}', { date: ui.format.dateTime('2026-11-27T18:01:00Z') }));
  assert.equal(remove.props.barId, second.id);
  assert.ok(![...elements(link)].some(node => node.type === 'BookmarkButton'));
  link.props.onPress(); assert.deepEqual(ui.calls.pop(), ['push', venueFromWantToTryHref(second.id)]);
  [...elements(tree.props.header)].find(node => node.type === 'FlowHeader').props.onBack();
  assert.equal(ui.calls.pop(), 'back');
  const missing = savedScreen(ui, { venues: [] });
  const missingNodes = [...elements(missing.props.renderItem({ item: missing.props.data[0] }))];
  assert.equal(missingNodes.find(node => node.type === ui.rows.ProfileActivityRow).props.venue.available, false);
  assert.equal(missingNodes.find(node => node.type === 'BookmarkButton').props.barId, second.id);
});

test('removing from Want to Try updates both list and Profile through the existing store', async () => {
  const store = createSavedBarsStore(owner, null, () => at), stop = store.start();
  await store.setSaved(venue.id, true);
  const ui = profileUi(), sync = () => Object.assign(ui.savedBars, store.getSnapshot(), { refresh: store.refresh, setSaved: store.setSaved });
  const unsubscribe = store.subscribe(sync); sync();
  const { BookmarkButton } = loadNativeModule('src/features/saved-bars/bookmark-button.tsx', { ...ui.mocks, './saved-bars-provider': { useSavedBars: () => ui.savedBars } });
  assert.equal(savedScreen(ui).props.data.length, 1);
  let stopped = 0;
  BookmarkButton({ barId: venue.id, name: venue.name }).props.onPress({ stopPropagation() { stopped++; } });
  await tick();
  assert.equal(stopped, 1); assert.equal(savedScreen(ui).props.data.length, 0);
  assert.ok(stats(ui).includes('Want to Try. 0'));
  unsubscribe(); stop();
});

test('loading/errors never display a fabricated zero or empty list, and existing confirmed records survive refresh failure', () => {
  const ui = profileUi();
  for (const status of ['loading', 'error']) {
    ui.savedBars.status = status; ui.savedBars.error = status === 'error';
    assert.ok(!stats(ui).includes('Want to Try. 0')); assert.equal(savedScreen(ui).props.empty, null);
  }
  ui.savedBars.status = 'ready'; ui.savedBars.bars = { [venue.id]: row(venue.id) };
  assert.ok(stats(ui).includes('Want to Try. 1')); assert.equal(savedScreen(ui).props.data.length, 1);
  ui.savedBars.bars = {}; ui.savedBars.error = false;
  assert.equal(savedScreen(ui).props.empty.props.title, 'No saved bars yet');
});

test('Want to Try refreshes saved records and metadata together, blocks duplicate refresh and retries errors', () => {
  const ui = profileUi(), metadata = [];
  savedScreen(ui, { onRefresh: () => metadata.push('catalog') }).props.onRefresh();
  assert.deepEqual(ui.calls, ['saved bars']); assert.deepEqual(metadata, ['catalog']);
  ui.savedBars.refreshing = true; const busy = savedScreen(ui, { onRefresh: () => metadata.push('catalog') });
  assert.equal(busy.props.refreshing, true); busy.props.onRefresh(); assert.equal(ui.calls.length, 1);
  ui.savedBars.refreshing = false; ui.savedBars.status = 'error'; ui.savedBars.error = true;
  const feedback = loadNativeModule('src/features/profile/saved-bars-feedback.tsx', ui.mocks).SavedBarsFeedback();
  const nodes = [...elements(feedback)];
  assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert'));
  nodes.find(node => node.props.label === 'Retry saved bars').props.onPress();
  assert.equal(ui.calls.length, 2);
});

test('Want to Try account route uses database metadata and refresh without guest fallback', () => {
  const ui = profileUi(), calls = [], catalog = { mode: 'account', venues: [{ ...venue, is_demo: true }], refreshing: true, refresh: () => calls.push('catalog') };
  const route = loadNativeModule('src/app/want-to-try.tsx', { ...ui.mocks,
    '@/features/catalog/catalog-provider': { useVenueCatalog: () => catalog }, '@/features/catalog/catalog-adapters': { catalogVenue: item => item },
    '@/features/catalog/catalog-feedback': { CatalogFeedback: 'CatalogFeedback' }, '@/features/profile/want-to-try-screen': { WantToTryScreen: 'WantToTryScreen' },
    '@/fixtures/venues': { mockVenues },
  }).default();
  assert.equal(route.props.venues.length, 1); assert.equal(route.props.refreshing, true);
  assert.deepEqual(Array.from(route.props.sampleVenueIds), [venue.id]); route.props.onRefresh(); assert.deepEqual(calls, ['catalog']);
});

test('Want to Try venue Back returns to the list with a direct-link fallback', () => {
  const calls = [], plan = resolveBarDetailsBack('wants', null);
  const nav = { canGoBack: () => true, back: () => calls.push('back'), replace: href => calls.push(href), dismissTo() {} };
  assert.equal(plan.label, 'Back to Want to Try'); navigateBackFromBarDetails(plan, nav); assert.equal(calls.pop(), 'back');
  navigateBackFromBarDetails(plan, { ...nav, canGoBack: () => false }); assert.deepEqual(calls.pop(), { pathname: '/want-to-try' });
});
