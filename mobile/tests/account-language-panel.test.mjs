import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import * as adapters from '../src/features/catalog/catalog-adapters.ts';
import * as ids from '../src/features/comparisons/comparison-state.ts';
import * as copy from '../src/localization/venue-copy.ts';
import * as stateModule from '../src/features/contributions/account-language-store.ts';
import { userId, otherUserId, barId, at, venue, impression } from './helpers/catalog-fixtures.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
const row = { id: '10000000-0000-4000-8000-000000000010', user_id: userId, bar_id: barId, language_code: 'it', status: 'pending', created_at: at, reviewed_at: null };
function setup() {
  const catalog = { userId, status: 'ready', venues: [venue({ languages: [{ code: 'en' }] })], impressions: { [barId]: impression() } };
  let state = { status: 'ready', error: false, refreshing: false, history: [row], operations: {}, queueStatus: 'ready', queueError: false,
    isModerator: false, queue: [], queueRefreshing: false, reviews: {} };
  let calls = [], harness = hookHarness(), module;
  const actions = { submit: (...args) => { calls.push(['submit', ...args]); return Promise.resolve(); },
    submitMany: (...args) => { calls.push(['submitMany', ...args]); return Promise.resolve(); },
    retryMany: (...args) => { calls.push(['retryMany', ...args]); return Promise.resolve(); },
    retry: (...args) => { calls.push(['retry', ...args]); return Promise.resolve(); },
    moderate: (...args) => { calls.push(['moderate', ...args]); return Promise.resolve(); },
    refresh: () => { calls.push(['refresh']); return Promise.resolve(); }, refreshQueue: () => { calls.push(['refreshQueue']); return Promise.resolve(); } };
  function load() {
    module = loadNativeModule('src/features/contributions/account-language-panel.tsx', {
      './optional-contribution-card':{OptionalContributionCard:'OptionalContributionCard'},react: harness.react, '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/constants/theme': theme,
      '@/features/profile/profile-activity-components': { ProfileActivitySection: 'ProfileActivitySection', ProfileActivityRow: 'ProfileActivityRow' },
      '@/features/catalog/catalog-adapters': adapters, '@/features/comparisons/comparison-state': ids,
      '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator('en'), format: createLocaleFormatters('en') }) },
      '@/localization/venue-copy': copy, './account-language-store': stateModule,
      './account-languages-provider': { useAccountLanguages: () => ({ ...state, ...actions }) },
      './spoken-languages-form': { SpokenLanguagesForm: 'SpokenLanguagesForm' },
    });
  }
  load();
  return { catalog, calls, get state() { return state; }, setState(patch) { state = { ...state, ...patch }; },
    render(name = 'AccountLanguagePanel', props = {}) { return [...elements(harness.render(() => module[name]({ catalog, barId, ...props })))]; },
    remount() { harness.unmount(); harness = hookHarness(); load(); }, stop() { harness.unmount(); } };
}

test('account language cards use database associations and owner pending rows and restore uncertain requests on reopen', () => {
  const ui = setup();
  assert.ok(ui.render().some(node => node.props.titleKey === 'Spoken languages'));
  const form = ui.render().find(node => node.type === 'SpokenLanguagesForm');
  assert.deepEqual(Array.from(form.props.languages, value => ({ ...value })), [{ code: 'en', name: 'English' }]);
  assert.equal(form.props.pending.length, 1); form.props.onSubmit(['fr','de']);
  assert.deepEqual(ui.calls[0], ['submitMany', barId, ['fr','de'], 0]);
  ui.setState({ operations: { [barId]: { version: 0, request: { id: row.id, barId, code: 'fr' }, saving: false, error: true, saved: false } } });
  ui.remount(); assert.ok(ui.render().some(node => node.props.titleKey === 'Spoken languages'));
  const reopened = ui.render().find(node => node.type === 'SpokenLanguagesForm');
  assert.deepEqual(Array.from(reopened.props.initialCodes), ['fr']); assert.equal(reopened.props.feedback.error, true);
  reopened.props.feedback.retry(); assert.deepEqual(ui.calls[1], ['retryMany', barId]); ui.stop();
});

test('bar languages include submitted unverified languages, hide rejected rows, and deduplicate approved associations', () => {
  const ui = setup();
  ui.setState({ history: [row, { ...row, id: 'duplicate', language_code: 'it' },
    { ...row, id: 'associated', language_code: 'en', status: 'approved' },
    { ...row, id: 'rejected', language_code: 'fr', status: 'rejected' },
    { ...row, id: 'other-bar', bar_id: 'other-bar', language_code: 'de' }] });
  let nodes = ui.render('AccountVenueLanguages', { languages: [{code:'en'}] });
  const copy = nodes.filter(node => node.type === 'Text').map(node => [node.props.children].flat().join(''));
  assert.equal(copy.filter(value => value === 'Italian · Not verified').length, 1);
  assert.ok(copy.includes('English'));assert.ok(!copy.some(value => /French|German|No languages/.test(value)));
  nodes = ui.render('AccountVenueLanguages', { languages: [] });
  assert.ok(!nodes.some(node => node.props.children === 'No languages reported yet.'));
  ui.setState({ history: [] });
  assert.ok(ui.render('AccountVenueLanguages', { languages: [] }).some(node => node.props.children === 'No languages reported yet.'));
  ui.stop();
});

test('language forms require a saved impression and loading errors expose retry without a demo form', () => {
  const ui = setup(); ui.catalog.impressions = {}; assert.equal(ui.render().length, 0);
  ui.catalog.impressions = { [barId]: impression() }; ui.setState({ status: 'error', error: true });
  assert.ok(ui.render().some(node => node.props.titleKey === 'Spoken languages'));
  assert.ok(!ui.render().some(node => node.type === 'SpokenLanguagesForm'));
  const feedback = ui.render('AccountLanguageFeedback');
  feedback.find(node => node.props.label === 'Retry language suggestions').props.onPress(); assert.deepEqual(ui.calls[0], ['refresh']); ui.stop();
});

test('Profile language history displays all review statuses and keeps unavailable venue metadata unavailable', () => {
  const ui = setup(), otherBar = '10000000-0000-4000-8000-000000000099'; let opened;
  ui.setState({ history: [row, { ...row, id: 'approved', status: 'approved', reviewed_at: at },
    { ...row, id: 'rejected', bar_id: otherBar, status: 'rejected', reviewed_at: at }] });
  const rows = ui.render('AccountLanguageHistory', { onOpenVenue: id => { opened = id; } }).filter(node => node.type === 'ProfileActivityRow');
  assert.equal(rows.length, 3);
  assert.ok(rows.some(node => node.props.summary.includes('Pending'))); assert.ok(rows.some(node => node.props.summary.includes('Approved')));
  const missing = rows.find(node => node.props.summary.includes('Rejected'));
  assert.equal(missing.props.venue.available, false); assert.equal(missing.props.venue.name, 'Venue unavailable');
  rows.find(node => node.props.venue.available).props.onPress(); assert.equal(opened, barId); ui.stop();
});

test('moderator queue is role-gated, shows no reporter names, and uncertain reviews expose only the same decision', () => {
  const ui = setup(); assert.equal(ui.render('AccountLanguageModeration').length, 0);
  ui.setState({ isModerator: true, queue: [{ ...row, user_id: otherUserId }] });
  const queue = ui.render('AccountLanguageModeration');
  queue.find(node => node.props.label === 'Approve language').props.onPress(); assert.deepEqual(ui.calls[0], ['moderate', row.id, 'approved']);
  assert.ok(!queue.some(node => node.props.children === otherUserId));
  ui.setState({ reviews: { [row.id]: { decision: 'approved', saving: false, error: true } } });
  const retry = ui.render('AccountLanguageModeration'); assert.ok(!retry.some(node => node.props.label === 'Reject language'));
  retry.find(node => node.props.label === 'Retry approval').props.onPress(); assert.deepEqual(ui.calls[1], ui.calls[0]);
  ui.setState({ isModerator: false, queueError: true });
  const failed = ui.render('AccountLanguageModeration'); assert.ok(!failed.some(node => node.props.label === 'Approve language'));
  failed.find(node => node.props.label === 'Retry language review access').props.onPress(); assert.deepEqual(ui.calls[2], ['refreshQueue']); ui.stop();
});
