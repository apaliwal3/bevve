import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { elements, loadNativeModule, flattenStyle } from './helpers/native-module.mjs';
import { profileUi } from './helpers/profile-ui.mjs';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { selectProfileFeed, profileFeedCopy, profileImpressionLabels } from '../src/features/profile/profile-feed.ts';
import { exitProfile, profileInitials } from '../src/features/profile/profile-identity.ts';
import { backToProfile, profileDestinations } from '../src/features/profile/profile-navigation.ts';
import { venueFromPlacesHref, venueFromProfileHref, resolveBarDetailsBack, navigateBackFromBarDetails } from '../src/features/venues/bar-details-navigation.ts';
import { saveVenueImpression } from '../src/features/impressions/impression-state.ts';
import { SESSION_USER_ID as user } from '../src/features/contributions/contribution-state.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import { en } from '../src/localization/en.ts';
import { it } from '../src/localization/it.ts';

const [a, b, c] = mockVenues.map(venue => venue.id), at = '2026-11-20T18:00:00.000Z';
const record = (impression = 'liked', bar_id = a, updated_at = at) => ({ user_id: user, bar_id, impression, updated_at, source: 'demo' });
const emptySource = () => ({ impressions: {}, crowdReports: [], bathroomReviews: [], priceObservations: [] });
const project = (source = emptySource()) => selectProfileContributions(source, user, mockVenues, mockDrinkCatalog);
const props = activity => ({ activity, onOpenVenue() {}, onWelcome() {} });
const texts = tree => [...elements(tree)].filter(node => node.type === 'Text').map(node => node.props.children);
function expanded(tree) {
  return [...elements(tree)].flatMap(node => typeof node.type === 'function' ? expanded(node.type(node.props)) : [node]);
}
function completeSource() {
  return { impressions: saveVenueImpression({}, record('fine', a, '2026-11-20T19:00:00+01:00')),
    crowdReports: [{ id: 'crowd', user_id: user, bar_id: b, level: 4, created_at: '2026-11-20T18:01:00Z' }],
    bathroomReviews: [{ id: 'bathroom', user_id: user, bar_id: a, cleanliness: 4, accessibility: null, wait_time: 5, created_at: at, updated_at: '2026-11-20T18:02:00Z' }],
    priceObservations: [{ id: 'price', submitted_by: user, bar_id: c, drink_id: mockDrinkCatalog[0].id, price_cents: 650, observed_at: '2026-11-20T18:03:00Z' }],
    privateIncidentReports: [{ description: 'NEVER_DISPLAY', created_at: '2026-11-20T18:04:00Z' }], languageSuggestions: [{ status: 'pending' }],
  };
}
test('Places Been counts distinct saved impressions of all three values; edits and other contributions add no visits', () => {
  const source = completeSource();
  source.impressions = [record('liked', a), record('fine', b), record('disliked', c)].reduce(saveVenueImpression, {});
  assert.equal(project(source).impressions.length, 3);
  source.impressions = saveVenueImpression(source.impressions, record('disliked', a, '2026-11-20T20:00:00Z'));
  assert.equal(project(source).impressions.length, 3);
  assert.equal(project(source).impressions.find(entry => entry.venue.id === a).impression, 'disliked');
  assert.equal(project({ ...source, impressions: {}, comparisons: [{ winner_bar_id: a }] }).impressions.length, 0);
});
test('feed orders four safe categories by actual timestamps, is read-only and excludes private/pending inputs', () => {
  const source = completeSource(), before = JSON.stringify(source), activity = project(source);
  const feed = selectProfileFeed(activity);
  assert.deepEqual(feed.map(item => item.kind), ['price', 'bathroom', 'crowd', 'impression']);
  assert.equal(JSON.stringify(source), before);
  assert.ok(!JSON.stringify(feed).includes('NEVER_DISPLAY') && !JSON.stringify(feed).includes('pending'));
  assert.deepEqual(selectProfileFeed(project()), []);
  const malformed = { ...activity, crowds: [{ ...activity.crowds[0], submittedAt: 'invalid' }] };
  assert.equal(selectProfileFeed(malformed).at(-1).kind, 'crowd');
  assert.deepEqual(selectProfileFeed(malformed), selectProfileFeed(malformed));
});
for (const language of ['en', 'it']) {
  test('Profile has exactly two clickable statistics and navigable actions in ' + language, () => {
    const ui = profileUi(language), tree = ui.render(props(project(completeSource())));
    assert.equal(tree.type, 'ProfileList');
    const nodes = expanded(tree.props.header);
    const cards = nodes.filter(node => node.type === 'Pressable' && [ui.t('Places Been') + '. 1', ui.t('Want to Try') + '. 0'].includes(node.props.accessibilityLabel));
    assert.equal(cards.length, 2); cards.forEach(card => card.props.onPress());
    nodes.find(node => node.type === 'PrimaryButton' && node.props.label === ui.t('Change Password')).props.onPress();
    nodes.find(node => node.props.accessibilityLabel === ui.t('Settings')).props.onPress();
    assert.deepEqual(ui.calls, [['push', profileDestinations.places], ['push', profileDestinations.wants], ['push', profileDestinations.password], ['push', profileDestinations.settings]]);
    assert.ok(nodes.some(node => node.props.children === ui.t('Demo mode')));
    assert.ok(!nodes.some(node => /followers|following|Elo|Explore bars|My impressions/i.test(String(node.props.children))));
    assert.equal(ui.render(props(project())).props.empty.props.title, ui.t('No activity yet'));
    assert.equal(ui.render({ ...props(project()), ready: false }).props.empty, null);
    assert.ok(!expanded(ui.render({ ...props(project()), countReady: false }).props.header).some(node => node.props.accessibilityLabel === ui.t('Places Been') + '. 0'));
  });
  test('activity rows open Bar Details with Profile context in ' + language, () => {
    const ui = profileUi(language), calls = [];
    const tree = ui.render({ ...props(project(completeSource())), onOpenVenue: id => calls.push(venueFromProfileHref(id)) });
    for (const item of tree.props.data) {
      const row = ui.rows.ProfileActivityRow(tree.props.renderItem({ item }).props);
      assert.ok(row.props.accessibilityLabel.includes(item.venue.name) && row.props.accessibilityLabel.includes(item.venue.area));
      row.props.onPress(); assert.deepEqual(calls.at(-1), venueFromProfileHref(item.venue.id));
    }
    assert.equal(ui.rows.ProfileActivityRow({ venue: { ...tree.props.data[0].venue, available: false }, summary: 'value', onPress() {} }).props.disabled, true);
  });
  test('concise impressions, independent bathroom scores, localized money and genuine dates in ' + language, () => {
    const ui = profileUi(language);
    for (const impression of ['liked', 'fine', 'disliked']) {
      const item = selectProfileFeed(project({ ...emptySource(), impressions: saveVenueImpression({}, record(impression)) }))[0];
      const copy = profileFeedCopy(item, ui.t, ui.format);
      assert.equal(copy.summary, ui.t('Your impression: {impression}', { impression: ui.t(profileImpressionLabels[impression]) }));
      assert.ok(!/★|\/5|\/10|Elo/.test(copy.summary));
    }
    const feed = selectProfileFeed(project(completeSource()));
    const bathroom = profileFeedCopy(feed.find(item => item.kind === 'bathroom'), ui.t, ui.format);
    assert.ok(bathroom.summary.includes('4/5') && bathroom.summary.includes('5/5') && bathroom.summary.includes(ui.t('Unavailable')));
    assert.ok(!bathroom.summary.includes(ui.t('Unavailable') + '/5'));
    assert.ok(profileFeedCopy(feed.find(item => item.kind === 'price'), ui.t, ui.format).summary.includes(ui.format.currency(650)));
    assert.equal(profileFeedCopy({ ...feed[0], at: 'bad' }, ui.t, ui.format).date, null);
  });
  test('Want to Try uses the existing demo catalog and the saved-list screen in ' + language, () => {
    const ui = profileUi(language), route = loadNativeModule('src/app/want-to-try.tsx', {
      ...ui.mocks, '@/features/catalog/catalog-provider': { useVenueCatalog: () => ({ mode: 'demo' }) },
      '@/features/catalog/catalog-adapters': {}, '@/features/catalog/catalog-feedback': {},
      '@/features/profile/want-to-try-screen': { WantToTryScreen: 'WantToTryScreen' }, '@/fixtures/venues': { mockVenues },
    }).default();
    assert.equal(route.type, 'WantToTryScreen');
    assert.equal(route.props.venues, mockVenues);
  });
  test('Places Been displays venues once, no visit dates, and correct venue/Back routes in ' + language, () => {
    const ui = profileUi(language), screen = loadNativeModule('src/features/profile/places-been-screen.tsx', ui.mocks);
    const tree = screen.PlacesBeenScreen({ activity: project(completeSource()) });
    assert.equal(tree.props.data.length, 1);
    const row = tree.props.renderItem({ item: tree.props.data[0] });
    assert.equal(row.props.date, undefined); row.props.onPress();
    assert.deepEqual(ui.calls.pop(), ['push', venueFromPlacesHref(a)]);
    [...elements(tree.props.header)].find(node => node.type === 'FlowHeader').props.onBack();
    assert.deepEqual(ui.calls, ['back']);
    assert.equal(screen.PlacesBeenScreen({ activity: project() }).props.empty.props.title, ui.t('No places yet'));
  });
  test('Change Password is informational in both account and demo modes in ' + language, () => {
    for (const demo of [true, false]) {
      const ui = profileUi(language, { auth: { session: demo ? null : { user: { id: user } } } });
      const screen = loadNativeModule('src/app/change-password.tsx', ui.mocks).default();
      assert.equal(screen.props.title, ui.t('Change Password'));
      assert.ok(texts(screen).includes(ui.t('Password changes are not available in the app yet.')));
      assert.equal([...elements(screen)].some(node => node.type === 'TextInput' || node.type === 'PrimaryButton'), false);
      assert.deepEqual(ui.calls, []);
    }
  });
}
test('demo exit skips auth; real logout awaits auth and failures stay on Profile', async () => {
  const calls = [];
  await exitProfile(null, async () => calls.push('auth'), () => calls.push('welcome'));
  assert.deepEqual(calls, ['welcome']); calls.length = 0;
  await exitProfile({ user }, async () => calls.push('auth'), () => calls.push('welcome'));
  assert.deepEqual(calls, ['auth', 'welcome']); calls.length = 0;
  await assert.rejects(exitProfile({ user }, async () => { throw Error('network'); }, () => calls.push('welcome')));
  assert.deepEqual(calls, []);
  for (const demo of [true, false]) {
    const ui = profileUi('it', { auth: { session: demo ? null : { user } } });
    const tree = ui.render({ ...props(project()), onWelcome: () => ui.calls.push('welcome') });
    expanded(tree.props.header).find(node => node.type === 'PrimaryButton' && node.props.label === ui.t(demo ? 'Return to Welcome' : 'Log Out')).props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(ui.calls, demo ? ['welcome'] : ['signOut', 'welcome']);
  }
});
test('Profile/Places native Back and direct-link fallback preserve the right origin', () => {
  const calls = [], nav = { canGoBack: () => true, back: () => calls.push('back'), replace: href => calls.push(href), dismissTo: href => calls.push(href) };
  for (const context of ['profile', 'places', 'settings']) {
    const plan = resolveBarDetailsBack(context, null);
    navigateBackFromBarDetails(plan, nav); assert.equal(calls.pop(), 'back');
    navigateBackFromBarDetails(plan, { ...nav, canGoBack: () => false });
    assert.equal(calls.pop().pathname, context === 'profile' ? '/profile' : context === 'places' ? '/places-been' : '/settings');
  }
  backToProfile(nav); assert.equal(calls.pop(), 'back');
  backToProfile({ ...nav, canGoBack: () => false }); assert.equal(calls.pop(), '/profile');
});
test('Profile uses one virtualized scroll surface, safe areas and flexible-height rows', () => {
  const ui = profileUi(), list = loadNativeModule('src/features/profile/profile-list.tsx', ui.mocks).ProfileList;
  const tree = list({ data: [], renderItem() {}, keyExtractor: item => item.id, header: { type: 'Header', props: {} } });
  assert.deepEqual(Array.from(tree.props.edges), ['top', 'left', 'right']);
  assert.equal(tree.props.children.type, 'FlatList');
  assert.equal(tree.props.children.props.getItemLayout, undefined);
  assert.equal(tree.props.children.props.initialNumToRender, 10);
  assert.equal([...elements(tree)].some(node => node.type === 'ScrollView'), false);
  const row = ui.rows.ProfileActivityRow({ venue: { ...mockVenues[0], available: true }, summary: 'value', onPress() {} });
  assert.ok(flattenStyle(row.props.style({ pressed: false })).minHeight >= 44);
  assert.ok(![...elements(row)].some(node => node.type === 'Text' && node.props.numberOfLines));
});
test('initials derive only from supplied display text, including Unicode', () => {
  assert.equal(profileInitials('Demo profile'), 'DP'); assert.equal(profileInitials('  Éva  Rossi  '), 'ÉR'); assert.equal(profileInitials(''), '');
});
test('Profile messages are explicitly translated in Italian', () => {
  const files = ['profile-view.tsx', 'profile-feed.ts', 'profile-activity-components.tsx', 'places-been-screen.tsx', 'profile-secondary-screen.tsx'].map(file => 'src/features/profile/' + file)
    .concat(['src/app/change-password.tsx', 'src/app/want-to-try.tsx']);
  const keys = files.flatMap(file => [...readFileSync(new URL('../' + file, import.meta.url), 'utf8').matchAll(/\bt\('([^']+)'/g)].map(match => match[1]));
  for (const key of [...keys, ...Object.values(profileImpressionLabels), 'You liked {name}', 'You thought {name} was fine', 'You disliked {name}']) {
    assert.ok(Object.hasOwn(en, key) && Object.hasOwn(it, key), key);
    if (/[a-z]/i.test(key.replace(/\{[^}]+\}/g, '').replace(/\bml\b/g, ''))) assert.notEqual(it[key], en[key], key);
  }
});

test('account Profile refreshes only its feed sources, handles loading/errors, and marks sample venues', () => {
  const ui = profileUi(), calls = [];
  ui.savedBars.refresh = async () => calls.push('saved bars');
  const catalog = { mode: 'account', userId: user, status: 'ready', refreshing: false, venues: [{ ...mockVenues[0], is_demo: true }], impressions: {}, drinks: [], refresh: async () => calls.push('catalog') };
  const contributions = { status: 'ready', refreshing: false, crowds: [], bathrooms: [], prices: [], refresh: async () => calls.push('contributions') };
  const module = loadNativeModule('src/features/profile/account-profile-screen.tsx', {
    ...ui.mocks,
    '@/features/catalog/catalog-adapters': { catalogVenue: row => row, savedImpressions: () => ({}) },
    '@/features/catalog/catalog-feedback': { CatalogFeedback: 'CatalogFeedback' },
    '@/features/contributions/account-contribution-panel': { AccountContributionFeedback: 'AccountContributionFeedback' },
    '@/features/contributions/account-contributions-provider': { useAccountContributions: () => contributions },
    './profile-activity': { selectProfileContributions }, './profile-view': { ProfileView: 'ProfileView' }, './places-been-screen': { PlacesBeenScreen: 'PlacesBeenScreen' },
  });
  let tree = module.AccountProfileScreen({ catalog });
  tree.props.onRefresh(); assert.deepEqual(calls, ['catalog', 'contributions', 'saved bars']);
  assert.deepEqual(Array.from(tree.props.sampleVenueIds), [a]);
  for (const state of [catalog, contributions, ui.savedBars]) {
    state.refreshing = true; tree = module.AccountProfileScreen({ catalog }); assert.equal(tree.props.refreshing, true);
    tree.props.onRefresh(); assert.equal(calls.length, 3); state.refreshing = false;
  }
  contributions.status = 'error'; tree = module.AccountProfileScreen({ catalog });
  assert.equal(tree.props.ready, false); assert.equal(tree.props.countReady, true);
  catalog.status = 'error'; assert.equal(module.AccountProfileScreen({ catalog }).props.countReady, false);
  calls.length = 0;
  tree = module.AccountProfileScreen({ catalog, places: true });
  assert.equal(tree.type, 'PlacesBeenScreen'); tree.props.onRefresh(); assert.deepEqual(calls, ['catalog']);
});

test('Settings omits language preferences and keeps private tools off Profile', () => {
  const ui = profileUi('en');
  const settings = loadNativeModule('src/app/settings.tsx', {
    ...ui.mocks, '@/features/catalog/catalog-provider': { useVenueCatalog: () => ({ mode: 'demo' }) },
    '@/localization/language-provider': { useTranslation: () => ({ t: ui.t, language: 'en' }) },
    '@/features/contributions/account-language-panel': {}, '@/features/contributions/account-safety-panel': {},
  });
  const nodes = [...elements(settings.default())];
  assert.equal(nodes.filter(node => ['radio', 'radiogroup', 'switch'].includes(node.props.accessibilityRole)).length, 0);
  assert.ok(!nodes.some(node => ['App language', 'English', 'Italiano'].includes(node.props.children)));
  assert.ok(nodes.some(node => node.props.children === 'Sign in to view your account tools.'));
  const header = expanded(ui.render(props(project())).props.header);
  assert.ok(!header.some(node => /incident|private|moderation/i.test(String(node.props.children))));
});

test('the actual Profile route forwards venue and demo-exit navigation and selects the account screen', () => {
  const ui = profileUi(), catalog = { mode: 'demo' };
  const route = loadNativeModule('src/app/(tabs)/profile.tsx', {
    ...ui.mocks, '@/features/catalog/catalog-provider': { useVenueCatalog: () => catalog },
    '@/features/profile/profile-screen': { ProfileScreen: 'ProfileScreen' },
    '@/features/catalog/account-routes': { AccountProfileScreen: 'AccountProfileScreen' },
  });
  let tree = route.default(); assert.equal(tree.type, 'ProfileScreen');
  tree.props.onOpenVenue(a); tree.props.onWelcome();
  assert.deepEqual(ui.calls, [['push', venueFromProfileHref(a)], ['dismissTo', '/']]);
  catalog.mode = 'account'; tree = route.default();
  assert.equal(tree.type, 'AccountProfileScreen'); assert.equal(tree.props.catalog, catalog);
});

test('all shared secondary headers use localized Profile Back and work on direct links', () => {
  for (const canGoBack of [true, false]) {
    const ui = profileUi('it', { canGoBack });
    const screen = loadNativeModule('src/features/profile/profile-secondary-screen.tsx', ui.mocks).ProfileSecondaryScreen;
    const tree = screen({ title: ui.t('Change Password'), children: null });
    const header = [...elements(tree)].find(node => node.type === 'FlowHeader');
    assert.equal(header.props.backLabel, ui.t('Back to Profile')); header.props.onBack();
    assert.deepEqual(ui.calls, canGoBack ? ['back'] : [['replace', '/profile']]);
  }
});

test('the profile read hook uses only existing username contract and ignores stale responses from another account', async () => {
  let session = { user: { id: 'account-a' } }, value = null, dependencies, cleanup;
  const requests = [];
  const client = { from(table) { assert.equal(table, 'profiles'); return { select(columns) {
    assert.equal(columns, 'username'); return { eq(field, id) {
      assert.equal(field, 'id'); return { single: () => new Promise(resolve => requests.push({ id, resolve })) };
    } };
  } }; } };
  const state = []; let cursor;
  const hook = loadNativeModule('src/features/profile/use-profile-identity.ts', {
    react: { useState: initial => { const index = cursor++; if (!(index in state)) state[index] = initial; return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }]; },
      useEffect(fn, deps) { if (JSON.stringify(deps) !== dependencies) { cleanup?.(); cleanup = fn(); dependencies = JSON.stringify(deps); } } },
    '@/features/auth/auth-provider': { useAuth: () => ({ session }) }, '@/lib/supabase': { supabase: client },
  });
  const render = () => { cursor = 0; value = hook.useProfileIdentity(); return value; };
  assert.equal(render().loading, true);
  session = { user: { id: 'account-b' } };
  assert.equal(render().username, null);
  requests[1].resolve({ data: { username: 'real_b' }, error: null });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(render().username, 'real_b');
  requests[0].resolve({ data: { username: 'stale_a' }, error: null });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(render().username, 'real_b');
  value.retry(); assert.equal(render().loading, true);
  requests[2].resolve({ data: null, error: { code: 'network' } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(render().error, true);
  assert.equal(value.username, null);
  session = null; assert.equal(render().demo, true); assert.equal(value.username, null);
  cleanup?.();
});
