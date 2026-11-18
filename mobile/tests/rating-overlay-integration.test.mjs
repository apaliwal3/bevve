import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as comparisonState from '../src/features/comparisons/comparison-state.ts';
import * as journeyState from '../src/features/ratings/rating-journey-state.ts';
import * as sentiments from '../src/features/sentiments/sentiment-state.ts';
import * as contributionState from '../src/features/contributions/contribution-state.ts';
import * as rankings from '../src/features/rankings/personal-rankings.ts';
import { mockVenues } from '../src/fixtures/venues.ts';
import { createTranslator, describeFixture } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { elements, flattenStyle, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { hookHarness } from './helpers/hook-harness.mjs';

const [a, b, c, d] = mockVenues;

function app() {
  let active;
  let context;
  let language = 'en';
  let sequence = 0;
  let catalog = mockVenues;
  let target = null;
  let overlayHooks;
  let tree;
  let reducedMotion = false;
  const providerHooks = hookHarness();
  const animations = [];
  const submissions = [];
  const timers = new Map();
  let timerId = 0;
  const nextId = () => 'e98f6a21-fc7c-47dd-a82d-' + (++sequence).toString(16).padStart(12, '0');
  const react = Object.fromEntries(Object.keys(providerHooks.react).map((name) => [name, (...args) => active.react[name](...args)]));
  react.createContext = () => ({ Provider: 'PersonalProvider' });
  react.useContext = () => context;
  const translation = { useTranslation: () => ({
    t: createTranslator(language), format: createLocaleFormatters(language),
    describe: (value) => describeFixture(value, createTranslator(language)),
  }) };
  const theme = loadNativeModule('src/constants/theme.ts');
  const provider = loadNativeModule('src/features/comparisons/personal-comparisons-provider.tsx', {
    react, '@/fixtures/venues': { mockVenues },
    '../contributions/contribution-state': { ...contributionState, createSessionSubmissionId: nextId },
    '../rankings/personal-rankings': rankings, '../ratings/rating-journey-state': journeyState,
    './comparison-state': comparisonState,
  }, { setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: (id) => timers.delete(id) });
  const selector = loadNativeModule('src/features/sentiments/sentiment-selector.tsx', {
    '@/constants/theme': theme, '@/localization/language-provider': translation, './sentiment-state': sentiments,
  });
  const card = loadNativeModule('src/features/comparisons/preference-venue-card.tsx', {
    react: { useState: (value) => [value, () => {}] }, 'expo-image': { Image: 'Image' },
    '@/components/app-icon': { AppIcon: 'AppIcon' }, '@/constants/theme': theme, '@/localization/language-provider': translation,
  });
  class Value {
    stopAnimation() {}
    interpolate(config) { return config.outputRange[0]; }
  }
  const overlay = loadNativeModule('src/features/ratings/venue-rating-overlay.tsx', {
    react,
    'react-native': {
      ...nativeStub, Modal: 'Modal', ScrollView: 'ScrollView',
      useWindowDimensions: () => ({ height: 568, width: 320 }),
      AccessibilityInfo: { isReduceMotionEnabled: async () => reducedMotion },
      Easing: { cubic: 'cubic', in: (value) => value, out: (value) => value },
      Animated: { Value, View: 'AnimatedView', timing: (_, config) => ({ start: (fn) => { animations.push(config); fn?.({ finished: true }); } }) },
      Platform: { OS: 'ios' }, StyleSheet: { create: (value) => value, absoluteFill: {} },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) },
    '@/localization/language-provider': translation, '@/constants/theme': theme,
    '@/components/app-icon': { AppIcon: 'AppIcon' }, '@/components/primary-button': { PrimaryButton: 'PrimaryButton' },
    '@/features/comparisons/personal-comparisons-provider': provider,
    '@/features/comparisons/preference-venue-card': card,
    '@/features/contributions/contribution-state': { createSessionSubmissionId: nextId },
    '@/features/sentiments/sentiment-selector': selector,
    './venue-ratings-provider': {
      useVenueContributions: () => ({ ownCrowdReport: null, ownBathroomReview: null,
        submitCrowdReport: (...args) => submissions.push(['crowd', ...args]), saveBathroomReview: (...args) => submissions.push(['bathrooms', ...args]) }),
      useVenueExtras: () => ({ drinks: [], languages: [], pendingLanguages: [], demoSafetyNotes: [],
        submitDrinkPrice: (...args) => submissions.push(['prices', ...args]), suggestLanguage: (...args) => submissions.push(['languages', ...args]),
        submitIncident: (...args) => submissions.push(['safety', ...args]) }),
    },
    ...Object.fromEntries([
      ['bathroom-review-form', 'BathroomReviewForm'], ['crowd-report-form', 'CrowdReportForm'], ['drink-price-form', 'DrinkPriceForm'],
      ['spoken-languages-form', 'SpokenLanguagesForm'], ['safety-information-form', 'SafetyInformationForm'],
    ].map(([file, name]) => ['@/features/contributions/' + file, { [name]: name }])),
  });
  const onClose = () => { target = null; };
  function render() {
    for (let iteration = 0; iteration < 25; iteration++) {
      active = providerHooks;
      context = providerHooks.render(() => provider.PersonalComparisonsProvider({ children: null, venues: catalog })).props.value;
      if (target) {
        active = overlayHooks;
        tree = overlayHooks.render(() => overlay.VenueRatingOverlay({ venue: target, onClose }));
      } else tree = null;
      providerHooks.effects();
      if (target) overlayHooks.effects();
      if (!providerHooks.dirty && (!target || !overlayHooks.dirty)) return tree;
    }
    assert.fail('Provider/overlay effects should settle without a render loop.');
  }
  function unmount() { overlayHooks?.unmount(); overlayHooks = null; target = null; render(); }
  function mount(venue) { if (overlayHooks) unmount(); target = venue; overlayHooks = hookHarness(); render(); }
  const nodes = () => [...elements(tree)];
  const button = (key) => nodes().find((node) => node.type === 'PrimaryButton' && node.props.label === createTranslator(language)(key));
  function press(key) { const node = button(key); assert.ok(node, key); assert.ok(!node.props.disabled, key); node.props.onPress(); render(); }
  function select(value) {
    const node = nodes().find((node) => node.type === selector.SentimentSelector);
    assert.ok(node); node.props.onChange(value); render();
  }
  function hook(fn) { active = hookHarness(); return active.render(fn); }
  render();
  return {
    mount, unmount, render, nodes, button, press, select, submissions, animations,
    get state() { return context.journey; }, get tree() { return tree; },
    get timers() { return timers; },
    setLanguage(value) { language = value; render(); },
    setCatalog(value) { catalog = value; render(); },
    getView() { return journeyState.getRatingJourneyView(context.journey, target?.id ?? a.id); },
    compare() { return hook(provider.usePersonalComparisons); },
    rankings() { return hook(provider.usePersonalRankings); },
    cards() { return nodes().filter((node) => node.type === card.PreferenceVenueCard); },
    selectorTree() { const node = nodes().find((node) => node.type === selector.SentimentSelector); return selector.SentimentSelector(node.props); },
    renderCard(node) { return card.PreferenceVenueCard(node.props); },
    replayEffects() { overlayHooks.replayEffects(); render(); },
    setReducedMotion(value) { reducedMotion = value; },
    dismiss() { tree.props.onRequestClose(); unmount(); },
    async show() { tree.props.onShow(); await new Promise((resolve) => setImmediate(resolve)); },
    experience(venue) {
      mount(venue); select('liked'); press('Save sentiment and continue');
      if (button('Skip remaining comparisons')) press('Skip remaining comparisons');
      unmount();
    },
  };
}

test('real overlay/provider wiring replaces the star gate with exactly three localized radio choices and requires selection', () => {
  const ui = app();
  ui.mount(a);
  assert.ok(ui.button('Save sentiment and continue').props.disabled);
  assert.equal(ui.nodes().some((node) => String(node.type).includes('StarSelector')), false);
  let radios = [...elements(ui.selectorTree())].filter((node) => node.props.accessibilityRole === 'radio');
  assert.deepEqual(radios.map((node) => node.props.accessibilityLabel), ['I liked it', 'It was fine', "I didn't like it"]);
  ui.select('fine');
  ui.setLanguage('it');
  radios = [...elements(ui.selectorTree())].filter((node) => node.props.accessibilityRole === 'radio');
  assert.deepEqual(radios.map((node) => node.props.accessibilityLabel), ['Mi è piaciuto', 'È stato nella media', 'Non mi è piaciuto']);
  assert.equal(radios[1].props.accessibilityState.checked, true);
  ui.dismiss();
  assert.deepEqual(ui.state.sentiments, {});
});

test('first save reveals all five optional cards without submitting them, and saved sentiment preselects on reopening', () => {
  const ui = app();
  ui.mount(a); ui.select('fine');
  const submit = ui.button('Save sentiment and continue').props.onPress;
  submit(); submit(); ui.render();
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.state.comparisons.history.length, 0);
  const labels = ui.nodes().filter((node) => node.type === 'Pressable').map((node) => node.props.accessibilityLabel);
  for (const label of ['Report crowd', 'Rate bathrooms', 'Update drink prices', 'Spoken languages', 'Safety information']) assert.ok(labels.includes(label));
  assert.deepEqual(ui.submissions, []);
  ui.dismiss(); ui.mount(a);
  assert.equal(ui.nodes().find((node) => node.props.value === 'fine').props.value, 'fine');
  ui.select('disliked'); ui.press('Save sentiment and continue');
  assert.equal(ui.state.sentiments[contributionState.SESSION_USER_ID][a.id].sentiment, 'disliked');
  assert.equal(Object.keys(ui.state.sentiments[contributionState.SESSION_USER_ID]).length, 1);
  assert.deepEqual(ui.submissions, []);
});

test('the second venue displays both names; either winner immediately updates the existing Compare and Rankings history', () => {
  const ui = app(); ui.experience(a);
  ui.mount(b); ui.select('disliked'); ui.press('Save sentiment and continue');
  assert.equal(ui.cards().length, 2);
  assert.deepEqual(ui.cards().map((node) => node.props.venue.name).sort(), [a.name, b.name].sort());
  assert.ok(ui.nodes().some((node) => node.props.children === 'Comparison 1 of 1'));
  const choice = ui.cards().find((node) => node.props.venue.id === a.id).props.onChoose;
  const staleSkip = ui.button('Skip remaining comparisons').props.onPress;
  choice(); choice(); staleSkip(); ui.render();
  assert.equal(ui.state.comparisons.history.length, 1);
  assert.equal(ui.state.comparisons.history[0].winner_bar_id, a.id);
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.rankings().completedCount, 1);
  ui.dismiss();
  assert.equal(ui.compare().savedCount, 1);
  const old = ui.compare(); old.choose(old.pair[1].id); ui.render();
  assert.equal(ui.rankings().completedCount, 2);
  assert.equal(ui.timers.size, 1);
  const queuedTimer = [...ui.timers.values()][0];
  ui.mount(a);
  assert.equal(ui.timers.size, 0);
  const round = ui.state.comparisons.round;
  queuedTimer(); ui.render();
  assert.equal(ui.state.comparisons.round, round);
  assert.equal(ui.state.comparisons.history.length, 2);
});

test('three-comparison UI progress, dismissal and explicit resume survive language switching without duplicate votes', () => {
  const ui = app(); [a, b, c].forEach((venue) => ui.experience(venue));
  ui.mount(d); ui.select('liked'); ui.press('Save sentiment and continue');
  assert.equal(ui.getView().progress.total, 3);
  ui.cards()[0].props.onChoose(); ui.render();
  const pending = ui.state.flows[d.id];
  const stale = ui.cards()[0].props.onChoose;
  ui.dismiss(); stale(); ui.render();
  assert.equal(ui.state.comparisons.history.length, 1);
  ui.mount(d);
  assert.ok(ui.button('Save and resume comparisons'));
  assert.equal(ui.cards().length, 0);
  ui.setLanguage('it'); ui.press('Save and resume comparisons');
  assert.equal(ui.state.flows[d.id], pending);
  assert.ok(ui.nodes().some((node) => node.props.children === 'Confronto 2 di 3'));
  ui.press('Skip this comparison');
  assert.ok(ui.nodes().some((node) => node.props.children === 'Confronto 3 di 3'));
  ui.press('Skip remaining comparisons');
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.state.comparisons.history.length, 1);
  ui.dismiss(); ui.mount(d); ui.press('Save sentiment and continue');
  assert.equal(ui.cards().length, 0);
  assert.equal(ui.state.comparisons.history.length, 1);
});

test('native modal prop/style wiring preserves safe areas, scrolling, reduced motion and accessible comparison cards', async () => {
  const ui = app(); ui.experience(a); ui.mount(b); ui.select('liked'); ui.press('Save sentiment and continue');
  const root = ui.tree.props.children;
  assert.ok(flattenStyle(root.props.style).paddingTop >= 59);
  assert.ok(flattenStyle(root.props.style).paddingBottom >= 34);
  const panel = ui.nodes().find((node) => node.props.accessibilityViewIsModal);
  assert.ok(flattenStyle(panel.props.style).maxHeight <= 568 - 59 - 34);
  const scroll = ui.nodes().find((node) => node.type === 'ScrollView');
  assert.equal(scroll.props.automaticallyAdjustKeyboardInsets, true);
  assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled');
  assert.equal(ui.tree.props.presentationStyle, 'overFullScreen');
  const choice = [...elements(ui.renderCard(ui.cards()[0]))].find((node) => node.props.accessibilityHint === 'Save this personal preference');
  assert.ok(choice.props.accessibilityLabel.includes(a.name) && choice.props.accessibilityLabel.includes(b.name));
  assert.equal(flattenStyle(choice.props.style({ pressed: false })).minHeight, 150);
  assert.ok(![...elements(ui.renderCard(ui.cards()[0]))].some((node) => node.props.children === 'View bar'));
  ui.setReducedMotion(true); await ui.show();
  assert.equal(ui.animations.at(-1).duration, 0);
  ui.dismiss(); assert.equal(ui.animations.at(-1).duration, 0);
});

test('all five unchanged optional form callbacks remain explicit and become inert on dismissal', () => {
  const ui = app(); ui.mount(a); ui.select('liked'); ui.press('Save sentiment and continue');
  const forms = [
    ['Report crowd', 'CrowdReportForm', [3]], ['Rate bathrooms', 'BathroomReviewForm', [{ cleanliness: 4, accessibility: 3, wait_time: 5 }]],
    ['Update drink prices', 'DrinkPriceForm', ['drink-id', 650]], ['Spoken languages', 'SpokenLanguagesForm', ['fr']],
    ['Safety information', 'SafetyInformationForm', [{ category: 'Other', description: 'Private test', occurred_at: null }]],
  ];
  const callbacks = [];
  for (const [label, component, args] of forms) {
    ui.nodes().find((node) => node.type === 'Pressable' && node.props.accessibilityLabel === label).props.onPress(); ui.render();
    const form = ui.nodes().find((node) => node.type === component);
    assert.ok(form); assert.equal(form.props.disabled, false);
    callbacks.push([form.props.onSubmit, args]);
    assert.equal(ui.submissions.length, callbacks.length - 1);
    form.props.onSubmit(...args);
    form.props.onCancel(); ui.render();
    assert.equal(ui.nodes().some((node) => node.type === component), false);
  }
  const before = JSON.stringify(ui.submissions);
  ui.setCatalog([a, b, c]);
  callbacks.forEach(([fn, args]) => fn(...args));
  assert.equal(JSON.stringify(ui.submissions), before); // Replaced catalog token, still-mounted overlay.
  ui.dismiss(); callbacks.forEach(([fn, args]) => fn(...args));
  assert.equal(JSON.stringify(ui.submissions), before);
  assert.equal(ui.state.comparisons.history.length, 0);
});

test('catalog removal and effect replay cannot leave an interactive stale overlay or reset pending history', () => {
  const ui = app(); ui.experience(a); ui.mount(b); ui.select('liked'); ui.press('Save sentiment and continue');
  const stale = ui.cards()[0].props.onChoose;
  ui.replayEffects(); // Development effect cleanup/setup must use a fresh overlay identity.
  assert.ok(ui.button('Save and resume comparisons'));
  ui.press('Save and resume comparisons');
  ui.setCatalog([a, c, d]); stale(); ui.render();
  assert.equal(ui.state.overlay, null);
  assert.equal(ui.state.comparisons.history.length, 0);
  ui.setCatalog(mockVenues); ui.mount(b); ui.press('Save and resume comparisons');
  assert.equal(ui.cards().length, 2);
});
