import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import * as storeModule from '../src/features/contributions/account-safety-store.ts';
import * as drafts from '../src/features/contributions/extra-form-drafts.ts';
import { userId, otherUserId, barId, at, venue } from './helpers/catalog-fixtures.mjs';

const theme = loadNativeModule('src/constants/theme.ts');
const inlineStyles = loadNativeModule('src/features/contributions/inline-form-styles.ts', { '@/constants/theme': theme });
const privateRow = { id: '20000000-0000-4000-8000-000000000001', reporter_id: userId, bar_id: barId, category: 'Theft',
  description: 'Private synthetic description', occurred_at: null, status: 'pending', created_at: at, reviewed_at: null };
const publicRow = { id: '20000000-0000-4000-8000-000000000002', bar_id: barId, summary: 'Separate public synthetic summary',
  verification_status: 'moderator_reviewed', published_at: at };
function setup() {
  const catalog = { userId, status: 'ready', venues: [venue()], impressions: {} };
  let state = { status: 'ready', error: false, refreshing: false, history: [privateRow], operations: {}, drafts: {},
    isModerator: false, queueStatus: 'ready', queueRefreshing: false, queueError: false, queue: [], reviews: {}, publicByVenue: {} };
  const calls = [], harness = hookHarness();
  const actions = Object.fromEntries(['submit','retry','refresh','refreshQueue','refreshPublic','moderate','updateDraft','updateReviewDraft'].map(name => [name,
    (...args) => { calls.push([name, ...args]); return Promise.resolve(); }]));
  const module = loadNativeModule('src/features/contributions/account-safety-panel.tsx', {
    './optional-contribution-card':{OptionalContributionCard:'OptionalContributionCard'},react: harness.react, '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/constants/theme': theme,
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator('en'), format: createLocaleFormatters('en') }) },
    './account-safety-provider': { useAccountSafety: () => ({ ...state, ...actions }) }, './account-safety-store': storeModule,
    './extra-form-drafts': drafts, './safety-information-form': { SafetyInformationForm: 'SafetyInformationForm' }, './inline-form-styles': inlineStyles,
  });
  return { catalog, calls, setState(patch) { state = { ...state, ...patch }; },
    render(name, props = {}) { const nodes = [...elements(harness.render(() => module[name]({ catalog, barId, ...props })))]; harness.effects(); return nodes; },
    stop() { harness.unmount(); } };
}
const strings = nodes => nodes.filter(node => node.type === 'Text').flatMap(node => [node.props.children].flat()).filter(value => typeof value === 'string');

test('public safety distinguishes loading, failed and empty reads and displays only the separate public summary', () => {
  const ui = setup();
  let nodes = ui.render('AccountPublishedSafety'); assert.ok(strings(nodes).includes('Loading published safety summaries…'));
  assert.ok(!strings(nodes).includes('No published safety information.')); assert.deepEqual(ui.calls[0], ['refreshPublic', barId]);
  ui.setState({ publicByVenue: { [barId]: { status: 'error', error: true, refreshing: false, rows: [] } } });
  nodes = ui.render('AccountPublishedSafety'); assert.ok(strings(nodes).includes('Published safety summaries could not be loaded.'));
  assert.ok(!strings(nodes).includes('No published safety information.'));
  nodes.find(node => node.props.label === 'Retry safety summaries').props.onPress(); assert.deepEqual(ui.calls[1], ['refreshPublic', barId]);
  ui.setState({ publicByVenue: { [barId]: { status: 'ready', error: false, refreshing: false, rows: [] } } });
  assert.ok(strings(ui.render('AccountPublishedSafety')).includes('No published safety information.'));
  ui.setState({ publicByVenue: { [barId]: { status: 'ready', error: false, refreshing: false, rows: [publicRow] } }, queue: [{ ...privateRow, reporter_id: otherUserId }] });
  const copy = strings(ui.render('AccountPublishedSafety')); assert.ok(copy.includes(publicRow.summary));
  assert.ok(!copy.includes(privateRow.description)); assert.ok(!copy.includes(userId)); assert.ok(!copy.includes(otherUserId)); ui.stop();
});

test('private incident forms use account drafts and retries without requiring an impression or fixture notes', () => {
  const ui = setup(), savedDraft = { category: 'Theft', description: privateRow.description, date: '2020-01-02' };
  ui.setState({ drafts: { [barId]: savedDraft }, operations: { [barId]: { version: 2, request: { id: privateRow.id }, saving: false, error: true, saved: false } } });
  assert.ok(ui.render('AccountIncidentPanel').some(node => node.props.titleKey === 'Safety information'));
  const form = ui.render('AccountIncidentPanel').find(node => node.type === 'SafetyInformationForm');
  assert.equal(form.props.draft, savedDraft); assert.equal(form.props.demoNotes.length, 0); assert.equal(form.props.feedback.error, true);
  form.props.feedback.retry(); assert.deepEqual(ui.calls[0], ['retry', barId, privateRow.id]);
  form.props.onDraftAction({ type: 'description', description: 'Next draft' }); assert.deepEqual(ui.calls[1], ['updateDraft', barId, { type: 'description', description: 'Next draft' }, 2]);
  form.props.onSubmit({ description: 'Stale form input' }); assert.deepEqual(ui.calls[2], ['submit', barId, 2]);
  form.props.onCancel(); assert.ok(ui.render('AccountIncidentPanel').some(node => node.type === 'SafetyInformationForm')); assert.equal(savedDraft.description, privateRow.description);
  ui.catalog.venues = []; assert.equal(ui.render('AccountIncidentPanel').length, 0); ui.stop();
});

test('private Profile history shows review statuses and descriptions with unavailable metadata kept unavailable', () => {
  const ui = setup(); ui.setState({ history: [privateRow, { ...privateRow, id: 'approved', status: 'approved', reviewed_at: at },
    { ...privateRow, id: 'rejected', status: 'rejected', reviewed_at: at, bar_id: '20000000-0000-4000-8000-000000000099' }] });
  const copy = strings(ui.render('AccountIncidentHistory'));
  for (const status of ['Pending','Approved','Rejected']) assert.ok(copy.some(value => value.startsWith(status + ' · Submitted')));
  assert.ok(copy.includes(privateRow.description)); assert.ok(copy.includes('Venue unavailable')); assert.ok(!copy.includes(userId)); ui.stop();
});

test('embedded private history keeps pending reports and dates without a repeated heading or inner card; moderation stays role-gated', () => {
  const ui = setup();
  const nodes = ui.render('AccountIncidentHistory', { embedded: true }), copy = strings(nodes);
  assert.ok(!copy.includes('My private incident reports'));
  assert.ok(copy.includes(privateRow.description));
  assert.ok(copy.some(value => value.startsWith('Pending · Submitted')));
  assert.ok(copy.includes('Visible only to you and moderators. These reports do not enter your public activity counts or rankings.'));
  assert.ok(!nodes.some(node => { const style = flattenStyle(node.props.style); return style.backgroundColor || style.borderWidth; }));
  assert.equal(ui.render('AccountIncidentModeration', { embedded: true }).length, 0);
  ui.setState({ history: [] });
  assert.ok(strings(ui.render('AccountIncidentHistory', { embedded: true })).includes('No private reports submitted yet.'));
  assert.deepEqual(ui.calls, []); ui.stop();
});

test('moderation requires role access and a blank, separately written public summary; retries lock the decision and exact draft', () => {
  const ui = setup(); assert.equal(ui.render('AccountIncidentModeration').length, 0);
  ui.setState({ isModerator: true, queue: [{ ...privateRow, reporter_id: otherUserId }] });
  let nodes = ui.render('AccountIncidentModeration'); assert.equal(nodes.find(node => node.props.accessibilityLabel === 'Public safety summary').props.value, '');
  assert.equal(nodes.find(node => node.props.label === 'Approve and publish summary').props.disabled, true);
  assert.ok(strings(nodes).includes(privateRow.description)); assert.ok(!strings(nodes).includes(otherUserId));
  nodes.find(node => node.props.accessibilityLabel === 'Public safety summary').props.onChangeText(publicRow.summary);
  assert.deepEqual(ui.calls[0], ['updateReviewDraft', privateRow.id, publicRow.summary]);
  ui.setState({ reviews: { [privateRow.id]: { draft: publicRow.summary, request: null, saving: false, error: false } } });
  nodes = ui.render('AccountIncidentModeration'); assert.equal(nodes.find(node => node.props.label === 'Approve and publish summary').props.disabled, false);
  nodes.find(node => node.props.label === 'Approve and publish summary').props.onPress(); assert.deepEqual(ui.calls[1], ['moderate', privateRow.id, 'approved']);
  ui.setState({ reviews: { [privateRow.id]: { draft: publicRow.summary, request: { id: privateRow.id, decision: 'approved', summary: publicRow.summary }, saving: false, error: true } } });
  nodes = ui.render('AccountIncidentModeration'); assert.equal(nodes.find(node => node.props.accessibilityLabel === 'Public safety summary').props.editable, false);
  assert.ok(!nodes.some(node => node.props.label === 'Reject private report')); nodes.find(node => node.props.label === 'Retry approval').props.onPress(); assert.deepEqual(ui.calls[2], ui.calls[1]);
  ui.setState({ isModerator: false, queueError: true }); nodes = ui.render('AccountIncidentModeration'); assert.ok(!strings(nodes).includes(privateRow.description));
  nodes.find(node => node.props.label === 'Retry incident review access').props.onPress(); assert.deepEqual(ui.calls[3], ['refreshQueue']); ui.stop();
});
