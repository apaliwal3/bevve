import assert from 'node:assert/strict';
import { test } from 'node:test';

import * as comparisonState from '../src/features/comparisons/comparison-state.ts';
import * as journeyState from '../src/features/ratings/rating-journey-state.ts';
import * as impressions from '../src/features/impressions/impression-state.ts';
import * as opinionPresentation from '../src/features/impressions/community-opinion-presentation.ts';
import * as contributionState from '../src/features/contributions/contribution-state.ts';
import * as rankings from '../src/features/rankings/personal-rankings.ts';
import { selectProfileContributions } from '../src/features/profile/profile-activity.ts';
import { mockDrinkCatalog } from '../src/fixtures/contribution-catalog.ts';
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
    '../impressions/impression-state': impressions,
    '../impressions/community-opinion-presentation': opinionPresentation,
  }, { setTimeout: (fn) => { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout: (id) => timers.delete(id) });
  const selector = loadNativeModule('src/features/impressions/impression-selector.tsx', {
    '@/constants/theme': theme, '@/localization/language-provider': translation, './impression-state': impressions,
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
    '@/features/contributions/contribution-batch':{ContributionBatch:'ContributionBatch',SaveContributionsButton:'SaveContributionsButton'},
    '@/features/contributions/optional-contribution-card':{OptionalContributionCard:'OptionalContributionCard'},
    './rating-overlay-styles':loadNativeModule('src/features/ratings/rating-overlay-styles.ts',{'@/constants/theme':theme}),
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
    '@/features/impressions/impression-selector': selector,
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
    const node = nodes().find((node) => node.type === selector.ImpressionSelector);
    assert.ok(node);
    const radios = [...elements(selector.ImpressionSelector(node.props))].filter((item) => item.props.accessibilityRole === 'radio');
    radios[impressions.impressionValues.indexOf(value)].props.onPress(); render();
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
    opinion(barId) { return hook(() => provider.useVenueOpinion(barId)); },
    savedImpressions() { return hook(provider.useSavedImpressions); },
    cards() { return nodes().filter((node) => node.type === card.PreferenceVenueCard); },
    selectorTree() { const node = nodes().find((node) => node.type === selector.ImpressionSelector); return selector.ImpressionSelector(node.props); },
    renderCard(node) { return card.PreferenceVenueCard(node.props); },
    replayEffects() { overlayHooks.replayEffects(); render(); },
    setReducedMotion(value) { reducedMotion = value; },
    dismiss() { tree.props.onRequestClose(); unmount(); },
    async show() { tree.props.onShow(); await new Promise((resolve) => setImmediate(resolve)); },
    experience(venue) {
      mount(venue); select('liked'); press('Save impression and continue');
      if (button('Skip remaining comparisons')) press('Skip remaining comparisons');
      unmount();
    },
  };
}

test('real overlay/provider wiring replaces the star gate with exactly three localized radio choices and requires selection', () => {
  const ui = app();
  ui.mount(a);
  assert.ok(ui.button('Save impression and continue').props.disabled);
  assert.equal(ui.nodes().some((node) => String(node.type).includes('StarSelector')), false);
  let radios = [...elements(ui.selectorTree())].filter((node) => node.props.accessibilityRole === 'radio');
  assert.deepEqual(radios.map((node) => node.props.accessibilityLabel), ['I liked it', 'It was fine', "I didn't like it"]);
  ui.select('fine');
  ui.setLanguage('it');
  radios = [...elements(ui.selectorTree())].filter((node) => node.props.accessibilityRole === 'radio');
  assert.deepEqual(radios.map((node) => node.props.accessibilityLabel), ['Mi è piaciuto', 'È stato nella media', 'Non mi è piaciuto']);
  assert.equal(radios[1].props.accessibilityState.checked, true);
  ui.dismiss();
  assert.deepEqual(ui.state.impressions, {});
});

test('first save reveals all five optional cards without submitting them, and saved impression preselects on reopening', () => {
  const ui = app();
  ui.mount(a); ui.select('fine');
  const submit = ui.button('Save impression and continue').props.onPress;
  submit(); submit(); ui.render();
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.state.comparisons.history.length, 0);
  const labels = ui.nodes().filter((node) => node.type === 'OptionalContributionCard').map((node) => node.props.titleKey);
  for (const label of ['Report crowd', 'Rate bathrooms', 'Update drink prices', 'Spoken languages', 'Safety information']) assert.ok(labels.includes(label));
  assert.deepEqual(ui.submissions, []);
  ui.dismiss(); ui.mount(a);
  assert.equal(ui.nodes().find((node) => node.props.value === 'fine').props.value, 'fine');
  ui.select('disliked'); ui.press('Save impression and continue');
  assert.equal(ui.state.impressions[contributionState.SESSION_USER_ID][a.id].impression, 'disliked');
  assert.equal(Object.keys(ui.state.impressions[contributionState.SESSION_USER_ID]).length, 1);
  assert.deepEqual(ui.submissions, []);
});

test('saved demo impressions feed Profile once across edits while community stays unavailable and Elo history stays identical', () => {
  const ui = app(); ui.experience(a);
  ui.mount(b); ui.select('fine'); ui.press('Save impression and continue');
  ui.cards()[0].props.onChoose(); ui.render(); ui.dismiss();
  const comparisons = ui.state.comparisons;
  const before = JSON.stringify({ history: comparisons.history, rankings: comparisons.rankings });
  const profile = () => selectProfileContributions({
    impressions: ui.savedImpressions(), crowdReports: [], bathroomReviews: [], priceObservations: [],
  }, contributionState.SESSION_USER_ID, mockVenues, mockDrinkCatalog);
  assert.equal(profile().counts.impressions, 2);
  assert.equal(ui.opinion(b.id).ownImpression, 'fine');
  assert.equal(ui.opinion(b.id).community.status, 'unavailable');
  ui.mount(b); ui.select('disliked'); ui.press('Save impression and continue');
  assert.equal(ui.getView().step, 'contributions');
  ui.dismiss(); ui.setLanguage('it');
  assert.equal(ui.opinion(b.id.toUpperCase()).ownImpression, 'disliked');
  assert.equal(ui.opinion(b.id).community.status, 'unavailable');
  assert.equal(profile().counts.impressions, 2);
  assert.equal(profile().impressions.find((entry) => entry.venue.id === b.id).impression, 'disliked');
  assert.equal(ui.state.comparisons.history, comparisons.history);
  assert.equal(ui.state.comparisons.rankings, comparisons.rankings);
  assert.equal(JSON.stringify({ history: ui.state.comparisons.history, rankings: ui.state.comparisons.rankings }), before);
  assert.equal(ui.rankings().completedCount, 1);
});

test('the second venue displays both names; either winner immediately updates shared comparison history and Rankings', () => {
  const ui = app(); ui.experience(a);
  ui.mount(b); ui.select('disliked'); ui.press('Save impression and continue');
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
  ui.mount(d); ui.select('liked'); ui.press('Save impression and continue');
  assert.equal(ui.getView().progress.total, 3);
  ui.cards()[0].props.onChoose(); ui.render();
  const pending = ui.state.flows[d.id];
  const stale = ui.cards()[0].props.onChoose;
  ui.dismiss(); stale(); ui.render();
  assert.equal(ui.state.comparisons.history.length, 1);
  ui.mount(d);
  assert.ok(ui.button('Resume comparisons'));
  assert.equal(ui.cards().length, 0);
  ui.setLanguage('it'); ui.press('Resume comparisons');
  assert.equal(ui.state.flows[d.id], pending);
  assert.ok(ui.nodes().some((node) => node.props.children === 'Confronto 2 di 3'));
  ui.press('Skip this comparison');
  assert.ok(ui.nodes().some((node) => node.props.children === 'Confronto 3 di 3'));
  ui.press('Skip remaining comparisons');
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.state.comparisons.history.length, 1);
  ui.dismiss(); ui.mount(d); ui.press('Continue to contributions');
  assert.equal(ui.cards().length, 0);
  assert.equal(ui.state.comparisons.history.length, 1);
});

test('native modal prop/style wiring preserves safe areas, scrolling, reduced motion and accessible comparison cards', async () => {
  const ui = app(); ui.experience(a); ui.mount(b); ui.select('liked'); ui.press('Save impression and continue');
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
  const ui = app(); ui.mount(a); ui.select('liked'); ui.press('Save impression and continue');
  const forms = [
    ['Report crowd', 'CrowdReportForm', [3]], ['Rate bathrooms', 'BathroomReviewForm', [{ cleanliness: 4, accessibility: 3, wait_time: 5 }]],
    ['Update drink prices', 'DrinkPriceForm', ['drink-id', 650]], ['Spoken languages', 'SpokenLanguagesForm', [['fr']]],
    ['Safety information', 'SafetyInformationForm', [{ category: 'Other', description: 'Private test', occurred_at: null }]],
  ];
  const callbacks = [];
  for (const [label, component, args] of forms) {
    assert.ok(ui.nodes().some((node) => node.type === 'OptionalContributionCard' && node.props.titleKey === label));
    const form = ui.nodes().find((node) => node.type === component);
    assert.ok(form); assert.equal(form.props.disabled, false);
    callbacks.push([form.props.onSubmit, args]);
    assert.equal(ui.submissions.length, callbacks.length - 1);
    form.props.onSubmit(...args);
    form.props.onCancel(); ui.render();
    assert.equal(ui.nodes().some((node) => node.type === component), true); // Collapsing retains the draft form.
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
  const ui = app(); ui.experience(a); ui.mount(b); ui.select('liked'); ui.press('Save impression and continue');
  const stale = ui.cards()[0].props.onChoose;
  ui.replayEffects(); // Development effect cleanup/setup must use a fresh overlay identity.
  assert.ok(ui.button('Resume comparisons'));
  ui.press('Resume comparisons');
  ui.setCatalog([a, c, d]); stale(); ui.render();
  assert.equal(ui.state.overlay, null);
  assert.equal(ui.state.comparisons.history.length, 0);
  ui.setCatalog(mockVenues); ui.mount(b); ui.press('Resume comparisons');
  assert.equal(ui.cards().length, 2);
});

test('Skip all, close and reopen exposes Compare again without automatically restarting or resaving the impression', () => {
  const ui = app(); ui.experience(a); ui.experience(b);
  const oldFlow = ui.state.flows[b.id], saved = ui.state.impressions;
  ui.mount(b);
  assert.equal(ui.cards().length, 0);
  assert.equal(ui.state.flows[b.id], oldFlow);
  assert.equal(ui.nodes().find((node) => node.props.value === 'liked').props.value, 'liked');
  assert.ok(ui.button('Continue to contributions'));
  ui.setLanguage('it');
  const again = ui.button('Compare this bar again').props.onPress;
  const staleContinue = ui.button('Continue to contributions').props.onPress;
  again(); again(); staleContinue(); ui.render();
  assert.equal(ui.getView().step, 'comparisons');
  assert.equal(ui.cards().length, 2);
  assert.notEqual(ui.state.flows[b.id].id, oldFlow.id);
  assert.equal(ui.state.impressions, saved);
  assert.equal(ui.state.comparisons.history.length, 0);
  assert.equal(ui.state.usedFlowIds.length, 3);
  assert.deepEqual(ui.submissions, []);
  ui.press('Skip remaining comparisons');
  assert.equal(ui.state.comparisons.history.length, 0);
  ui.dismiss();
  again(); staleContinue(); ui.render();
  assert.equal(ui.state.comparisons.history.length, 0);
});

test('completed votes survive Compare again, with no new vote or Elo change before a real choice', () => {
  const ui = app(); ui.experience(a);
  ui.mount(b); ui.select('fine'); ui.press('Save impression and continue');
  const oldVote = ui.cards()[0].props.onChoose;
  oldVote(); ui.render();
  const history = ui.state.comparisons.history, rankings = ui.state.comparisons.rankings, saved = ui.state.impressions;
  const oldId = ui.state.flows[b.id].id;
  ui.dismiss(); ui.mount(b); ui.press('Compare this bar again');
  assert.notEqual(ui.state.flows[b.id].id, oldId);
  assert.equal(ui.state.comparisons.history, history);
  assert.equal(ui.state.comparisons.rankings, rankings);
  assert.equal(ui.state.impressions, saved);
  assert.deepEqual(ui.state.flows[b.id].opponentIds, [a.id]);
  oldVote(); ui.render();
  assert.equal(ui.state.comparisons.history, history);
  const choose = ui.cards().find((node) => node.props.venue.id === b.id).props.onChoose;
  choose(); choose(); ui.render();
  assert.equal(ui.state.comparisons.history.length, 2);
  assert.equal(ui.rankings().completedCount, 2);
  assert.equal(ui.state.comparisons.history[1].winner_bar_id, b.id);
  assert.equal(ui.state.comparisons.history[1].loser_bar_id, a.id);
  assert.equal(ui.state.comparisons.history[0], history[0]);
  assert.equal(ui.getView().step, 'contributions');
});

test('an unfinished revisit offers Resume instead of restart, and Continue to contributions keeps its pending prompts', () => {
  const ui = app(); [a, b, c].forEach((venue) => ui.experience(venue));
  ui.mount(d); ui.select('disliked'); ui.press('Save impression and continue');
  ui.cards()[0].props.onChoose(); ui.render();
  const pending = ui.state.flows[d.id], saved = ui.state.impressions, history = ui.state.comparisons.history;
  const usedFlowIds = ui.state.usedFlowIds;
  ui.dismiss(); ui.mount(d);
  assert.ok(ui.button('Resume comparisons'));
  assert.equal(ui.button('Compare this bar again'), undefined);
  ui.press('Continue to contributions');
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.state.flows[d.id], pending);
  assert.equal(ui.nodes().filter((node) => node.type === 'OptionalContributionCard' && ['Report crowd', 'Rate bathrooms', 'Update drink prices', 'Spoken languages', 'Safety information'].includes(node.props.titleKey)).length, 5);
  ui.dismiss(); ui.mount(d); ui.setLanguage('it'); ui.press('Resume comparisons');
  assert.equal(ui.state.flows[d.id], pending);
  assert.deepEqual(ui.getView().progress, { current: 2, total: 3 });
  assert.equal(ui.state.impressions, saved);
  assert.equal(ui.state.comparisons.history, history);
  assert.equal(ui.state.usedFlowIds, usedFlowIds);
  assert.deepEqual(ui.submissions, []);
});

test('all three impression values save through the circles; zero eligible opponents shows an honest message and stale starts cannot bypass catalog changes', () => {
  for (const impression of impressions.impressionValues) {
    const ui = app(); ui.mount(a); ui.select(impression); ui.press('Save impression and continue');
    assert.equal(ui.state.impressions[contributionState.SESSION_USER_ID][a.id].impression, impression);
    assert.equal(ui.getView().step, 'contributions');
    assert.ok(ui.nodes().some((node) => node.props.children === 'No other experienced bars are available to compare yet.'));
    ui.dismiss(); ui.mount(a);
    assert.equal(ui.button('Compare this bar again'), undefined);
    assert.equal(ui.button('Resume comparisons'), undefined);
    ui.press('Continue to contributions');
    assert.equal(ui.state.comparisons.history.length, 0);
  }
  const ui = app(); ui.experience(a); ui.experience(b); ui.mount(b);
  const stale = ui.button('Compare this bar again').props.onPress;
  const flow = ui.state.flows[b.id];
  ui.setCatalog([b]);
  assert.equal(ui.button('Compare this bar again'), undefined);
  assert.ok(ui.nodes().some((node) => node.props.children === 'No other experienced bars are available to compare yet.'));
  stale(); ui.render();
  assert.equal(ui.state.flows[b.id], flow);
  ui.setLanguage('it'); ui.press('Continue to contributions');
  assert.equal(ui.getView().step, 'contributions');
  assert.equal(ui.state.comparisons.history.length, 0);
});
