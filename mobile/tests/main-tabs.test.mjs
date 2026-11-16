import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

// Expo SDK 58's bundled pure routers; no native renderer is loaded.
import { TabRouter, TabActions } from 'expo-router/build/react-navigation/routers/TabRouter.js';
import { StackRouter } from 'expo-router/build/react-navigation/routers/StackRouter.js';
import { appendMissingPlaceholderTabRoutes } from 'expo-router/build/standard-navigation/appendMissingPlaceholderTabRoutes.js';
import { createTranslator } from '../src/localization/translation.ts';
import { navigateBackFromBarDetails, resolveBarDetailsBack } from '../src/features/venues/bar-details-navigation.ts';
import { priceComparisonHref, resolvePriceNavigation, venueFromPricesHref } from '../src/features/prices/price-navigation.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';

const names = ['explore', 'compare', 'rankings', 'profile'];
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
    key: 'main-tabs', type: 'tab', stale: false, routeKeySeq: 4, index: 0,
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

test('one persistent navigator owns four tab routes; providers and detail routes remain outside it', () => {
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
  for (const file of ['src/app/(tabs)/explore.tsx', 'src/features/comparisons/personal-compare-screen.tsx', 'src/features/rankings/personal-rankings-screen.tsx', 'src/features/profile/profile-screen.tsx']) {
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
    assert.equal(buttons.length, 4);
    buttons.forEach((button, index) => {
      assert.equal(button.props.accessibilityRole, 'tab');
      assert.equal(button.props.accessibilityLabel, createTranslator(language)(['Explore', 'Compare', 'Rankings', 'Profile'][index]));
      assert.equal(button.props.accessibilityState.selected, index === 0);
      assert.equal([...elements(button)].find((node) => node.type === 'AppIcon').props.name, names[index]);
      button.props.onPress();
    });
    assert.deepEqual(destinations, ['compare-1', 'rankings-2', 'profile-3']);
    assert.equal(events.length, 4);
    buttons[1].props.onLongPress();
    assert.equal(events.at(-1).type, 'tabLongPress');
    const blocked = tabBar(language, initialTabs(), () => assert.fail('A prevented tab event must not navigate.'), true);
    blocked.buttons[1].props.onPress();
  }
});

test('all four tab controls are available before lazy routes have been visited', () => {
  const initial = initialTabs();
  const state = appendMissingPlaceholderTabRoutes({ ...initial, routes: [initial.routes[0]] },
    Object.fromEntries(names.map((name) => [name, { route: { name } }])));
  const destinations = [];
  const { buttons } = tabBar('it', state, (key) => destinations.push(key));
  assert.equal(buttons.length, 4);
  buttons[3].props.onPress();
  assert.deepEqual(destinations, ['profile']);
});

test('repeated tab selections preserve route keys and inactive state without accumulating Back history', () => {
  let state = initialTabs();
  const nested = { key: 'comparison-flow', type: 'stack', stale: false, routeKeySeq: 1, index: 0,
    routeNames: ['pair'], routes: [{ name: 'pair', key: 'current-pair', params: { round: 4 } }] };
  state = { ...state, routes: state.routes.map((route) => route.name === 'compare' ? { ...route, state: nested } : route) };
  const keys = state.routes.map((route) => route.key);
  for (let round = 0; round < 30; round++) {
    for (const name of names) {
      state = tabRouter.getStateForAction(state, TabActions.jumpTo(name), tabOptions).state;
      assert.equal(state.routes[state.index].name, name);
      assert.deepEqual(state.routes.map((route) => route.key), keys);
      assert.equal(state.routes.find((route) => route.name === 'compare').state, nested);
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
