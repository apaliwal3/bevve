import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import * as adapters from '../src/features/catalog/catalog-adapters.ts';
import * as distances from '../src/features/location/venue-distance.ts';
import { barId, userId, venue } from './helpers/catalog-fixtures.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
const translation = { t: createTranslator('en'), format: createLocaleFormatters('en') };
const origin = { latitude: 0, longitude: 0, accuracy: 30, timestamp: Date.now() };
function setup() {
  const harness = hookHarness(), calls = [];
  let state = { enabled: true, status: 'ready', fix: origin, canAskAgain: true, issue: null, settingsError: false };
  const actions = { enable: () => { calls.push('enable'); return Promise.resolve(); }, refresh: () => { calls.push('refresh'); return Promise.resolve(); },
    openSettings: async () => { calls.push('settings'); } };
  const mock = { useAccountLocation: () => ({ ...actions, ...state }) };
  const catalog = { status: 'ready', refreshing: false, impressions: {}, drinks: [], userId,
    venues: [venue({ id: 'far', is_demo: false, latitude: 0.02, longitude: 0 }), venue({ id: barId, is_demo: false, latitude: 0.001, longitude: 0 }), venue({ id: 'sample', latitude: 0, longitude: 0 })], refresh: async () => { calls.push('catalog'); } };
  const shared = { react: harness.react, '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/constants/theme': theme,
    '@/localization/language-provider': { useTranslation: () => translation }, '@/features/location/account-location-provider': mock };
  const explore = loadNativeModule('src/features/catalog/account-explore-screen.tsx', { ...shared,
    'expo-router': { router: { navigate() {}, push: value => calls.push(value) } }, '@/components/logo': { Logo: 'Logo' }, '@/components/app-icon': { AppIcon: 'AppIcon' },
    '@/components/screen-container': { ScreenContainer: 'ScreenContainer' }, '@/components/venue-card': { VenueCard: 'VenueCard' },
    '@/features/prices/price-navigation': { priceComparisonHref: () => '/prices' }, './catalog-adapters': adapters, './catalog-feedback': { CatalogFeedback: 'CatalogFeedback' },
    '@/features/location/location-feedback': { LocationFeedback: 'LocationFeedback' }, '@/features/location/venue-distance': distances,
  });
  const feedback = loadNativeModule('src/features/location/location-feedback.tsx', { ...shared, './account-location-provider': mock });
  function render(component = 'explore', props = {}) {
    const tree = harness.render(() => component === 'explore' ? explore.AccountExploreScreen({ catalog }) : feedback.LocationFeedback());
    harness.effects(); return [...elements(tree)];
  }
  return { catalog, calls, render, set(patch) { state = { ...state, ...patch }; }, stop() { harness.unmount(); } };
}
const copy = nodes => nodes.filter(node => node.type === 'Text').flatMap(node => [node.props.children].flat()).filter(value => typeof value === 'string');
const chip = (nodes, label) => nodes.find(node => node.type === 'Pressable' && [...elements(node)].some(child => child.props.children === label));

test('Explore uses the shared automatic location session and Nearby waits for a fix without claiming zero results', () => {
  const ui = setup();ui.set({status:'locating',fix:null}); let nodes = ui.render(); assert.deepEqual(ui.calls, []); assert.equal(nodes.filter(node => node.type === 'VenueCard').length, 3);
  chip(nodes, 'Nearby').props.onPress(); assert.deepEqual(ui.calls, []);
  ui.set({ enabled: true, status: 'locating' }); nodes = ui.render(); assert.equal(nodes.filter(node => node.type === 'VenueCard').length, 0);
  assert.ok(!copy(nodes).includes('0 venues')); assert.ok(!copy(nodes).some(value => value.startsWith('No matching real venues')));
  assert.ok(nodes.some(node => node.type === 'LocationFeedback')); ui.stop();
});

test('Nearby cards use real distances and samples remain excluded; other filters continue to work when permission is denied', () => {
  const ui = setup(); chip(ui.render(), 'Nearby').props.onPress(); ui.set({ enabled: true, status: 'ready', fix: origin });
  let nodes = ui.render(); const cards = nodes.filter(node => node.type === 'VenueCard'); assert.equal(cards.length, 1);
  assert.equal(cards[0].props.venue.id, barId); assert.ok(cards[0].props.venue.distanceLabel.startsWith('About 110 m'));
  ui.set({ status: 'denied', fix: null }); chip(ui.render(), 'All').props.onPress(); nodes = ui.render();
  assert.equal(nodes.filter(node => node.type === 'VenueCard').length, 3); assert.ok(nodes.some(node => node.type === 'LocationFeedback'));
  assert.ok(nodes.filter(node => node.type === 'VenueCard').every(node => node.props.venue.distanceLabel === null)); ui.stop();
});

test('All keeps real venue distances before and after visiting Nearby without a stop-location control', () => {
  const ui=setup();let nodes=ui.render();
  let cards=nodes.filter(node=>node.type==='VenueCard');assert.equal(cards.length,3);
  assert.ok(cards.filter(node=>node.props.venue.id!=='sample').every(node=>node.props.venue.distanceLabel));
  assert.equal(cards.find(node=>node.props.venue.id==='sample').props.venue.distanceLabel,null);
  chip(nodes,'Nearby').props.onPress();assert.equal(ui.render().filter(node=>node.type==='VenueCard').length,1);
  chip(ui.render(),'All').props.onPress();nodes=ui.render();cards=nodes.filter(node=>node.type==='VenueCard');
  assert.equal(cards.length,3);assert.ok(cards.find(node=>node.props.venue.id===barId).props.venue.distanceLabel);
  assert.ok(nodes.some(node=>node.type==='LocationFeedback'));
  assert.ok(!ui.render('feedback').some(node=>node.props.label==='Stop using location'));assert.deepEqual(ui.calls,[]);ui.stop();
});

test('a valid Nearby empty result stays explicit and returning to All keeps location available',()=>{
  const ui=setup();chip(ui.render(),'Nearby').props.onPress();ui.set({fix:{...origin,latitude:50}});
  assert.ok(copy(ui.render()).includes('No matching real venues within 1 km of your current location.'));
  chip(ui.render(),'All').props.onPress();assert.equal(ui.render().filter(node=>node.type==='VenueCard').length,3);
  assert.deepEqual(ui.calls,[]);ui.stop();
});

test('permission feedback distinguishes blocked access, services disabled, coarse fixes and timeout with retry/settings actions', () => {
  const ui = setup(); ui.set({ enabled: true, status: 'denied', canAskAgain: false });
  let nodes = ui.render('feedback'); assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert'));
  nodes.find(node => node.props.label === 'Open location settings').props.onPress(); assert.deepEqual(ui.calls, ['settings']);
  ui.set({ status: 'services-off' }); assert.ok(copy(ui.render('feedback')).includes('Turn on device location services, then retry.'));
  ui.set({ status: 'unavailable', issue: 'accuracy' }); nodes = ui.render('feedback'); assert.ok(copy(nodes).some(value => value.includes('precise location')));
  assert.ok(nodes.some(node => node.props.label === 'Open location settings'));
  ui.set({ issue: 'timeout' }); nodes = ui.render('feedback'); assert.ok(copy(nodes).some(value => value.includes('took too long')));
  nodes.find(node => node.props.label === 'Use my location').props.onPress(); assert.deepEqual(ui.calls, ['settings', 'enable']); ui.stop();
});

test('ready location has no explanatory notes or controls', () => {
  const ui=setup();ui.set({enabled:true,status:'ready',fix:origin});
  assert.deepEqual(ui.render('feedback'),[]);assert.deepEqual(ui.calls,[]);ui.stop();
});

test('foreground adapter calls only foreground APIs and releases its native subscription', async () => {
  const calls = []; let next, error, removed = 0;
  const { locationRepository: repository } = loadNativeModule('src/features/location/location-repository.ts', {
    'expo-location': { Accuracy: { Balanced: 42 }, getForegroundPermissionsAsync: async () => { calls.push('get'); return { granted: true }; },
      requestForegroundPermissionsAsync: async () => { calls.push('request'); return { granted: true }; }, hasServicesEnabledAsync: async () => true,
      watchPositionAsync: async (options, callback, failure) => { assert.equal(options.accuracy, 42); next = callback; error = failure; return { remove() { removed++; } }; } },
    'expo-linking': { openSettings: async () => { calls.push('settings'); } },
  });
  await repository.permissions(); await repository.requestPermissions(); assert.equal(await repository.servicesEnabled(), true);
  let fix, failed = false; const stop = await repository.watch(value => { fix = value; }, () => { failed = true; });
  next({ coords: origin }); assert.deepEqual(fix, { coords: origin }); error(); assert.equal(failed, true); stop(); assert.equal(removed, 1);
  await repository.openSettings(); assert.deepEqual(calls, ['get','request','settings']);
});

test('location provider skips guest stores, keys account lifetimes, and pauses on background while permission-dialog inactivity is tolerated', () => {
  const harness = hookHarness(), calls = []; let mode = { mode: 'demo' }, stateChange;
  const store = { getSnapshot: () => ({ enabled: false, status: 'idle', fix: null }), getServerSnapshot: () => ({}), subscribe() {},
    start: foreground => { calls.push(['start',foreground]); return () => calls.push(['stop']); }, suspend: () => calls.push(['suspend']), resume: () => calls.push(['resume']),
    enable() {}, refresh() {}, openSettings() {} };
  const module = loadNativeModule('src/features/location/account-location-provider.tsx', {
    react: { ...harness.react, createContext: () => ({ Provider: 'LocationProvider' }), useContext: () => null, useSyncExternalStore: (_subscribe, get) => get() },
    'react-native': { AppState: { currentState: 'active', addEventListener(name, listener) { assert.equal(name, 'change'); stateChange = listener; return { remove: () => calls.push(['remove']) }; } } },
    '@/features/catalog/catalog-provider': { useVenueCatalog: () => mode }, './location-repository': { locationRepository: {} },
    './location-store': { createLocationStore: () => { calls.push(['create']); return store; } },
  });
  assert.equal(module.AccountLocationProvider({ children: null }).props.value, null); assert.deepEqual(calls, []);
  mode = { mode: 'account', userId }; const account = module.AccountLocationProvider({ children: null }); assert.equal(account.key, userId);
  harness.render(() => account.type(account.props)); harness.effects(); stateChange('inactive'); assert.deepEqual(calls, [['create'],['start',true]]);
  stateChange('background'); stateChange('active'); harness.unmount(); assert.deepEqual(calls, [['create'],['start',true],['suspend'],['resume'],['stop'],['remove']]);
});


test('Explore only animates a manual pull and ignores automatic catalog and location loading',async()=>{
  const ui=setup();ui.set({status:'locating'});ui.catalog.refreshing=true;
  let screen=ui.render().find(node=>node.type==='ScreenContainer');assert.equal(screen.props.refreshing,false);
  let finishLocation;const locationPromise=new Promise(resolve=>{finishLocation=resolve;});
  ui.set({refresh:()=>{ui.calls.push('refresh');return locationPromise;}});
  chip(ui.render(),'Quiet').props.onPress();screen=ui.render().find(node=>node.type==='ScreenContainer');
  const first=screen.props.onRefresh();screen.props.onRefresh();assert.deepEqual(ui.calls,['catalog','refresh']);
  assert.equal(ui.render().find(node=>node.type==='ScreenContainer').props.refreshing,true);
  finishLocation();await first;
  const nodes=ui.render();assert.equal(nodes.find(node=>node.type==='ScreenContainer').props.refreshing,false);
  assert.ok(chip(nodes,'Quiet').props.accessibilityState.selected);ui.stop();
});


test('Quiet and Popular empty results keep the filter row compact and show a prominent empty-state heading',()=>{
  const ui=setup();ui.catalog.venues=ui.catalog.venues.map(row=>({...row,crowd:{...row.crowd,classification:null},is_popular:false}));
  const filterRow=nodes=>nodes.find(node=>node.props.horizontal===true);
  const original=flattenStyle(filterRow(ui.render()).props.style);
  for(const filter of ['Quiet','Popular']){
    chip(ui.render(),filter).props.onPress();const nodes=ui.render();
    assert.equal(nodes.filter(node=>node.type==='VenueCard').length,0);
    const row=filterRow(nodes);assert.deepEqual(flattenStyle(row.props.style),original);
    assert.equal(original.flexGrow,0);assert.equal(original.flexShrink,0);
    const buttons=row.props.children;
    assert.ok(buttons.every(button=>flattenStyle(button.props.style).minHeight===44));
    assert.ok(buttons.every(button=>flattenStyle(button.props.style).flexShrink===0));
    const heading=nodes.find(node=>node.props.children===`No ${filter.toLowerCase()} bars found`);
    assert.equal(heading.props.accessibilityRole,'header');assert.equal(flattenStyle(heading.props.style).fontSize,22);
    assert.equal(flattenStyle(heading.props.style).textAlign,'center');
  }
  ui.stop();
});
