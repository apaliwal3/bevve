import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

// Expo SDK 58's bundled pure routers; no native renderer is loaded.
import { TabRouter, TabActions } from 'expo-router/build/react-navigation/routers/TabRouter.js';
import { StackRouter } from 'expo-router/build/react-navigation/routers/StackRouter.js';
import { appendMissingPlaceholderTabRoutes } from 'expo-router/build/standard-navigation/appendMissingPlaceholderTabRoutes.js';
import { resolveNavigationDestination } from 'expo-router/build/global-state/resolveNavigationDestination.js';
import { createTranslator } from '../src/localization/translation.ts';
import { navigateBackFromBarDetails, resolveBarDetailsBack } from '../src/features/venues/bar-details-navigation.ts';
import { priceComparisonHref, resolvePriceNavigation, venueFromPricesHref } from '../src/features/prices/price-navigation.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';

const names = ['explore', 'rankings', 'profile'];
const theme = loadNativeModule('src/constants/theme.ts');
const Tabs = Object.assign(() => null, { Screen: 'TabScreen' });
const layout = loadNativeModule('src/app/(tabs)/_layout.tsx', {
  'expo-router/js-tabs': { Tabs },
  '@/components/app-tabs': { default: 'AppTabs' },
  '@/constants/theme': theme,
  '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator('en') }) },
});
const layoutProps = layout.default().props;
const tabRouter = TabRouter({ backBehavior: layoutProps.backBehavior });
const tabOptions = { routeNames: names, routeGetIdList: {}, routeParamList: {} };
function initialTabs() {
  return tabRouter.getStateForDeclaredRoutes({
    key: 'main-tabs', type: 'tab', stale: false, routeKeySeq: 3, index: 0,
    routeNames: names, routes: names.map((name, index) => ({ name, key: name + '-' + index })),
  }, names);
}
function tabBar(language, state, navigateToTab, prevented = false, events = []) {
  const { default: Bar } = loadNativeModule('src/components/app-tabs-layout.tsx', {
    '@/constants/theme': theme,
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator(language) }) },
    './app-icon': { AppIcon: 'AppIcon' },
    'react-native-safe-area-context': {
      SafeAreaView: 'SafeAreaView',
      useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
    },
  });
  const tree = Bar({ state, navigateToTab, emitter: { emit: (event) => { events.push(event); return { defaultPrevented: prevented }; } } });
  const buttons = tree.props.children.props.children.map((element) => element.type(element.props));
  return { tree, buttons };
}

test('one persistent navigator owns exactly three tab routes; providers, the legacy redirect and detail routes remain outside it', () => {
  assert.equal(layoutProps.backBehavior, 'none');
  assert.equal(layoutProps.screenOptions.animation, 'none');
  assert.equal(layoutProps.screenOptions.headerShown, false);
  assert.equal(layoutProps.screenOptions.lazy, true);
  assert.equal(layoutProps.screenOptions.freezeOnBlur, false);
  assert.deepEqual(Array.from(layoutProps.children, (screen) => screen.props.name), names);
  assert.equal(layoutProps.tabBar({ state: 'sentinel' }).props.state, 'sentinel');
  for (const name of names) {
    assert.ok(existsSync(new URL('../src/app/(tabs)/' + name + '.tsx', import.meta.url)));
    assert.equal(existsSync(new URL('../src/app/' + name + '.tsx', import.meta.url)), false);
  }
  const groupSource = readFileSync(new URL('../src/app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  const rootSource = readFileSync(new URL('../src/app/_layout.tsx', import.meta.url), 'utf8');
  for (const provider of ['LanguageProvider', 'VenueRatingsProvider', 'PersonalComparisonsProvider']) {
    assert.equal((rootSource.match(new RegExp('<' + provider + '(?:>|\\\\s)', 'g')) ?? []).length, 1);
    assert.equal(groupSource.includes(provider), false);
  }
  assert.equal(existsSync(new URL('../src/app/(tabs)/compare.tsx', import.meta.url)), false);
  assert.ok(existsSync(new URL('../src/app/compare.tsx', import.meta.url)));
  assert.equal(existsSync(new URL('../src/features/comparisons/personal-compare-screen.tsx', import.meta.url)), false);
  for (const file of ['src/app/(tabs)/explore.tsx', 'src/features/rankings/personal-rankings-screen.tsx', 'src/features/profile/profile-screen.tsx']) {
    assert.equal(readFileSync(new URL('../' + file, import.meta.url), 'utf8').includes('<AppTabs'), false);
  }
  for (const file of ['bars/[barId].tsx', 'prices.tsx']) {
    assert.ok(existsSync(new URL('../src/app/' + file, import.meta.url)));
    assert.equal(existsSync(new URL('../src/app/(tabs)/' + file, import.meta.url)), false);
  }
  assert.equal(rootSource.includes('gestureEnabled: false'), false);
});

test('the real tab bar retains icons, selection and safe areas in EN/IT and selects tabs without stack links', () => {
  for (const language of ['en', 'it']) {
    const destinations = [], events = [];
    const { tree, buttons } = tabBar(language, initialTabs(), (key) => destinations.push(key), false, events);
    assert.equal(flattenStyle(tree.props.children.props.style).paddingBottom, 34);
    assert.equal(buttons.length, 3);
    buttons.forEach((button, index) => {
      assert.equal(button.props.accessibilityRole, 'tab');
      assert.equal(button.props.accessibilityLabel, createTranslator(language)(['Explore', 'Rankings', 'Profile'][index]));
      assert.equal(button.props.accessibilityState.selected, index === 0);
      assert.equal([...elements(button)].find((node) => node.type === 'AppIcon').props.name, names[index]);
      button.props.onPress();
    });
    assert.deepEqual(destinations, ['rankings-1', 'profile-2']);
    assert.equal(events.length, 3);
    buttons[1].props.onLongPress();
    assert.equal(events.at(-1).type, 'tabLongPress');
    const blocked = tabBar(language, initialTabs(), () => assert.fail('A prevented tab event must not navigate.'), true);
    blocked.buttons[1].props.onPress();
    for (const name of names) {
      const selected = tabRouter.getStateForAction(initialTabs(), TabActions.jumpTo(name), tabOptions).state;
      const bar = tabBar(language, selected, () => {});
      assert.deepEqual(Array.from(bar.buttons, (button) => button.props.accessibilityState.selected), names.map((item) => item === name));
    }
  }
});

test('all three tab controls are available before lazy routes have been visited', () => {
  const initial = initialTabs();
  const state = appendMissingPlaceholderTabRoutes({ ...initial, routes: [initial.routes[0]] },
    Object.fromEntries(names.map((name) => [name, { route: { name } }])));
  const destinations = [];
  const { buttons } = tabBar('it', state, (key) => destinations.push(key));
  assert.equal(buttons.length, 3);
  buttons[2].props.onPress();
  assert.deepEqual(destinations, ['profile']);
});

test('repeated tab selections preserve route keys and inactive state without accumulating Back history', () => {
  let state = initialTabs();
  const nested = { key: 'rankings-state', type: 'stack', stale: false, routeKeySeq: 1, index: 0,
    routeNames: ['list'], routes: [{ name: 'list', key: 'ranking-list' }] };
  state = { ...state, routes: state.routes.map((route) => route.name === 'rankings' ? { ...route, state: nested } : route) };
  const keys = state.routes.map((route) => route.key);
  for (let round = 0; round < 30; round++) {
    for (const name of names) {
      state = tabRouter.getStateForAction(state, TabActions.jumpTo(name), tabOptions).state;
      assert.equal(state.routes[state.index].name, name);
      assert.deepEqual(state.routes.map((route) => route.key), keys);
      assert.equal(state.routes.find((route) => route.name === 'rankings').state, nested);
      assert.equal(state.history.length, 1);
    }
  }
  assert.equal(tabRouter.getStateForAction(state, { type: 'GO_BACK' }, tabOptions), 'UNHANDLED');
});

test('root-stack venue and price round trips return to each selected tab with UUID and drink context intact', () => {
  const rootRouter = StackRouter({});
  const rootNames = ['index', '(tabs)', 'bars/[barId]', 'prices'];
  const options = { routeNames: rootNames, routeGetIdList: {}, routeParamList: {} };
  const drinkId = mockDrinkCatalog[1].id, sourceBarId = mockVenues[0].id;
  for (const origin of names) {
    const tabs = tabRouter.getStateForAction(initialTabs(), TabActions.jumpTo(origin), tabOptions).state;
    let state = {
      key: 'root', type: 'stack', stale: false, routeKeySeq: 2, index: 1, routeNames: rootNames,
      routes: [{ key: 'welcome', name: 'index' }, { key: 'tabs', name: '(tabs)', state: tabs }],
    };
    const act = (action) => { const result = rootRouter.getStateForAction(state, action, options); assert.ok(result.state); state = result.state; };
    act({ type: 'PUSH', payload: { name: 'bars/[barId]', params: { barId: sourceBarId, ...(origin === 'explore' ? {} : { returnTo: origin }) } } });
    act({ type: 'PUSH', payload: { name: 'prices', params: priceComparisonHref(drinkId, sourceBarId).params } });
    const priceRoute = state.routes[state.index];
    const resolved = resolvePriceNavigation(priceRoute.params, mockDrinkCatalog, mockVenues, null);
    assert.equal(resolved.drink.id, drinkId);
    assert.equal(resolved.sourceVenue.id, sourceBarId);
    const destination = venueFromPricesHref(mockVenues[1].id, drinkId, sourceBarId);
    act({ type: 'PUSH', payload: { name: 'bars/[barId]', params: destination.params } });
    const navigation = {
      canGoBack: () => state.index > 0,
      back: () => act({ type: 'GO_BACK' }),
      replace: () => assert.fail('Existing stack history must be used.'),
      dismissTo: () => { while (state.routes[state.index].name !== '(tabs)') act({ type: 'GO_BACK' }); },
    };
    navigateBackFromBarDetails(resolveBarDetailsBack('prices', drinkId, sourceBarId), navigation);
    assert.equal(state.routes[state.index].key, priceRoute.key);
    act({ type: 'GO_BACK' }); // Prices returns to its original Bar Details instance.
    assert.equal(state.routes[state.index].params.barId, sourceBarId);
    navigateBackFromBarDetails(resolveBarDetailsBack(origin === 'explore' ? undefined : origin, drinkId), navigation);
    assert.equal(state.routes.length, 2);
    assert.equal(state.routes[state.index].state, tabs);
    assert.equal(tabs.routes[tabs.index].name, origin);
  }
});

// Resolve the same nested POP_TO action used by Expo Router's dismissTo. This
// exercises the installed SDK routers, not a hand-written approximation of Back.
function legacyNavigation(withTabs, origin = 'explore') {
  const rootRouter = StackRouter({});
  const rootNames = ['index', '(tabs)', 'compare', 'bars/[barId]'];
  const rootOptions = { routeNames: rootNames, routeGetIdList: {}, routeParamList: {} };
  const routeNode = { route: '', children: rootNames.map((route) => ({ route, children: route === '(tabs)' ? names.map((name) => ({ route: name, children: [] })) : [] })) };
  const tabs = tabRouter.getStateForAction(initialTabs(), TabActions.jumpTo(origin), tabOptions).state;
  let state = {
    key: 'root', type: 'stack', stale: false, routeKeySeq: 3, index: withTabs ? 2 : 0, routeNames: rootNames,
    routes: withTabs ? [{ key: 'index:0', name: 'index' }, { key: '(tabs):1', name: '(tabs)', state: tabs }, { key: 'compare:2', name: 'compare' }]
      : [{ key: 'old-link', name: 'compare' }],
  };
  function dismissTo(href) {
    assert.equal(typeof href === 'string' ? href : href.pathname, '/rankings');
    const registry = new Map([['root', { reduce: (value, action) => rootRouter.getStateForAction(value, action, rootOptions) }]]);
    for (const route of state.routes) if (route.state) registry.set(route.state.key, { reduce: (value, action) => tabRouter.getStateForAction(value, action, tabOptions) });
    const action = resolveNavigationDestination({
      targetState: { routes: [{ name: '(tabs)', state: { routes: [{ name: 'rankings' }] } }] },
      navigationState: state, routeNode, registry, action: { type: 'POP_TO', payload: {} },
    });
    const result = rootRouter.getStateForAction(state, action, rootOptions);
    assert.ok(result.state);
    state = result.state;
  }
  return {
    dismissTo, get state() { return state; }, originalTabsKey: withTabs ? '(tabs):1' : null,
    reopen() { state = rootRouter.getStateForAction(state, { type: 'PUSH', payload: { name: 'compare' } }, rootOptions).state; },
  };
}

test('legacy /compare redirects outside the tab group to Rankings without retaining Compare or duplicating a tab stack', () => {
  for (const withTabs of [false, true]) for (const origin of names) {
    const navigation = legacyNavigation(withTabs, origin);
    const focus = [];
    const route = loadNativeModule('src/app/compare.tsx', {
      react: { useCallback: (callback) => callback },
      'expo-router': { useFocusEffect: (callback) => focus.push(callback), router: { dismissTo: navigation.dismissTo } },
    });
    for (let visit = 0; visit < 3; visit++) {
      assert.equal(route.default(), null);
      assert.equal(navigation.state.routes.at(-1).name, 'compare');
      focus.at(-1)();
      const state = navigation.state;
      assert.equal(state.routes.some((item) => item.name === 'compare'), false);
      assert.equal(state.routes.filter((item) => item.name === '(tabs)').length, 1);
      const tabs = state.routes.at(-1);
      assert.equal(tabs.state.routes[tabs.state.index].name, 'rankings');
      assert.equal(tabs.state.routeNames.includes('compare'), false);
      if (navigation.originalTabsKey) assert.equal(tabs.key, navigation.originalTabsKey);
      assert.equal(state.routes.length, withTabs ? 2 : 1);
      if (visit < 2) navigation.reopen();
    }
  }
});

test('old returnTo=compare dismisses to Rankings without disturbing current Profile, Rankings or price return plans', () => {
  const navigation = legacyNavigation(true);
  navigateBackFromBarDetails(resolveBarDetailsBack('compare', null), {
    dismissTo: navigation.dismissTo,
    canGoBack: () => true, back: () => assert.fail('Do not pop back to the old Compare screen.'), replace: () => assert.fail('Reuse the tab stack.'),
  });
  const tabs = navigation.state.routes.at(-1).state;
  assert.equal(tabs.routes[tabs.index].name, 'rankings');
  for (const origin of ['rankings', 'profile', 'prices']) assert.equal(resolveBarDetailsBack(origin, null).mode, 'back');
});
