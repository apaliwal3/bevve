import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { elements, flattenStyle, loadNativeModule } from './helpers/native-module.mjs';
import { hookHarness } from './helpers/hook-harness.mjs';
import { profileUi } from './helpers/profile-ui.mjs';
import { profileDestinations } from '../src/features/profile/profile-navigation.ts';
import { venueFromSettingsHref } from '../src/features/venues/bar-details-navigation.ts';

const nodes = tree => [...elements(tree)];
const forbidden = () => { throw new Error('Informational screens must not access credentials or storage'); };

test('Profile retains its statistics, activity and gear while account actions live only in Settings', () => {
  for (const session of [null, { user: { id: 'owner' } }]) {
    const ui = profileUi('en', { auth: { session } });
    const tree = ui.render({ activity: { impressions: [], crowds: [], bathrooms: [], prices: [] }, onOpenVenue() {} });
    const header = nodes(tree.props.header);
    assert.ok(!header.some(node => ['Edit Profile', 'Change Password', 'Log Out', 'Return to Welcome'].includes(node.props.label)));
    assert.equal(existsSync(new URL('../src/app/edit-profile.tsx', import.meta.url)), false);
    assert.equal(profileDestinations.edit, undefined);
    const settings = header.find(node => node.props.accessibilityLabel === 'Settings');
    assert.equal(settings.props.accessibilityRole, 'button');
    assert.ok(flattenStyle(settings.props.style).minHeight >= 44);
    assert.equal(nodes(settings).find(node => node.type === 'AppIcon').props.name, 'settings');
    settings.props.onPress();
    assert.deepEqual(ui.calls, [['push', '/settings']]);
    assert.ok(header.some(node => node.props.children === 'Activity'));
  }
});

test('Change Password has only informational copy, with safe-area/header Back and direct-link fallback', () => {
  for (const canGoBack of [true, false]) {
    const ui = profileUi('en', { canGoBack });
    const route = loadNativeModule('src/app/change-password.tsx', {
      ...ui.mocks,
      '@/features/auth/auth-provider': { useAuth: forbidden },
      '@/lib/supabase': new Proxy({}, { get: forbidden }),
      '@react-native-async-storage/async-storage': new Proxy({}, { get: forbidden }),
    }, { fetch: forbidden, console: new Proxy({}, { get: forbidden }) }).default();
    assert.equal(route.props.title, 'Change Password');
    assert.ok(nodes(route).some(node => node.props.children === 'Password changes are not available in the app yet.'));
    assert.ok(!nodes(route).some(node => /Input|Button|Pressable/.test(String(node.type)) || node.props.onChangeText || node.props.onSubmit));
    assert.deepEqual(ui.calls, []);
    const secondary = loadNativeModule('src/features/profile/profile-secondary-screen.tsx', ui.mocks).ProfileSecondaryScreen(route.props);
    assert.equal(secondary.type, 'ScreenContainer');
    const header = nodes(secondary).find(node => node.type === 'FlowHeader');
    assert.equal(header.props.title, 'Change Password');
    assert.equal(header.props.backLabel, 'Back to Settings');
    header.props.onBack();
    assert.deepEqual(ui.calls, canGoBack ? ['back'] : [['replace', '/settings']]);
  }
  // Lock the dependency boundary as well as the rendered no-input behavior.
  const source = readFileSync(new URL('../src/app/change-password.tsx', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/from '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(imports, ['react-native', '@/constants/theme', '@/features/profile/profile-secondary-screen', '@/localization/language-provider']);
});

// These tests inspect actual component props and hook transitions, not native rendering.
function settingsUi(mode = 'account') {
  const ui = profileUi('en', { auth: { session: mode === 'account' ? { user: { id: 'owner' } } : null } });
  const catalog = { mode, userId: 'owner', venues: [], impressions: {} };
  const harness = hookHarness();
  const module = loadNativeModule('src/app/settings.tsx', {
    ...ui.mocks, react: harness.react,
    '@/features/catalog/catalog-provider': { useVenueCatalog: () => catalog },
    '@/features/contributions/account-language-panel': { AccountLanguageHistory: 'AccountLanguageHistory', AccountLanguageModeration: 'AccountLanguageModeration' },
    '@/features/contributions/account-safety-panel': { AccountIncidentHistory: 'AccountIncidentHistory', AccountIncidentModeration: 'AccountIncidentModeration' },
  });
  const route = module.default();
  const tools = nodes(route).find(node => node.type.name === 'AccountTools');
  const actions = nodes(route).find(node => node.type.name === 'AccountActions');
  return { ...ui, catalog, route, tools, actions, render: element => harness.render(() => element.type(element.props)) };
}
const rows = tree => nodes(tree).filter(node => node.type.name === 'SettingsRow').map(node => node.type(node.props));
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Settings groups account actions and contributions without language preferences or demo private histories', () => {
  for (const mode of ['demo', 'account']) {
    const ui = settingsUi(mode);
    assert.equal(ui.route.props.title, 'Settings');
    const copy = nodes(ui.route).filter(node => node.type === 'Text').map(node => node.props.children);
    assert.equal(copy.filter(value => value === 'Account').length, 1);
    assert.equal(copy.filter(value => value === 'Contributions').length, 1);
    assert.ok(!copy.some(value => ['App language', 'English', 'Italiano'].includes(value)));
    assert.equal(ui.actions.key, mode === 'account' ? ui.catalog.userId : 'demo');
    const accountRows = rows(ui.render(ui.actions));
    assert.deepEqual(accountRows.map(row => row.props.accessibilityLabel), ['Change Password', mode === 'account' ? 'Log Out' : 'Return to Welcome']);
    accountRows[0].props.onPress();
    assert.deepEqual(ui.calls, [['push', '/change-password']]);
    if (mode === 'demo') {
      assert.equal(ui.tools, undefined);
      assert.ok(copy.includes('Sign in to view your account tools.'));
      assert.ok(!nodes(ui.route).some(node => /Account.*History|Account.*Moderation/.test(String(node.type))));
    } else {
      assert.equal(ui.tools.props.catalog, ui.catalog);
      assert.equal(ui.tools.key, ui.catalog.userId);
    }
  }
});

test('Settings demo exit skips auth and account logout awaits success, prevents duplicates and exposes retry on failure', async () => {
  const demo = settingsUi('demo');
  rows(demo.render(demo.actions))[1].props.onPress();
  await settle();
  assert.deepEqual(demo.calls, [['dismissTo', '/']]);
  const ui = settingsUi();
  let resolve;
  ui.auth.signOut = () => { ui.calls.push('signOut'); return new Promise(done => { resolve = done; }); };
  const logout = rows(ui.render(ui.actions))[1];
  logout.props.onPress(); logout.props.onPress();
  assert.deepEqual(ui.calls, ['signOut']);
  const pending = rows(ui.render(ui.actions))[1];
  assert.equal(pending.props.disabled, true);
  assert.equal(pending.props.accessibilityState.busy, true);
  resolve(); await settle();
  assert.deepEqual(ui.calls, ['signOut', ['dismissTo', '/']]);
  const failed = settingsUi();
  failed.auth.signOut = async () => { throw Error('network'); };
  rows(failed.render(failed.actions))[1].props.onPress(); await settle();
  const tree = failed.render(failed.actions);
  assert.ok(nodes(tree).some(node => node.props.accessibilityRole === 'alert'));
  assert.deepEqual(failed.calls, []);
  assert.equal(rows(tree)[1].props.disabled, false);
  failed.auth.signOut = async () => failed.calls.push('retry');
  rows(tree)[1].props.onPress(); await settle();
  assert.deepEqual(failed.calls, ['retry', ['dismissTo', '/']]);
});

test('compact Settings disclosures use embedded histories and role-gated moderation without changing records', () => {
  for (const index of [0, 1]) {
    const ui = settingsUi();
    const sections = nodes(ui.tools.type(ui.tools.props)).filter(node => node.type.name === 'SettingsSection');
    assert.deepEqual(sections.map(node => node.props.label), ['My language suggestions', 'My private incident reports']);
    const section = sections[index], before = JSON.stringify(ui.catalog);
    const render = () => ui.render(section);
    let tree = render(), row = rows(tree)[0];
    assert.equal(row.props.accessibilityLabel, section.props.label);
    assert.equal(row.props.accessibilityState.expanded, false);
    assert.ok(flattenStyle(row.props.style({ pressed: false })).minHeight >= 44);
    assert.ok(!nodes(tree).some(node => /History|Moderation/.test(String(node.type))));
    const label = nodes(row).find(node => node.type === 'Text');
    assert.equal(label.props.numberOfLines, undefined);
    assert.equal(flattenStyle(label.props.style).height, undefined);
    row.props.onPress(); tree = render();
    assert.equal(rows(tree)[0].props.accessibilityState.expanded, true);
    const history = nodes(tree).find(node => node.type === (index === 0 ? 'AccountLanguageHistory' : 'AccountIncidentHistory'));
    assert.equal(history.props.catalog, ui.catalog);
    assert.equal(history.props.embedded, true);
    const moderation = nodes(tree).find(node => node.type === (index === 0 ? 'AccountLanguageModeration' : 'AccountIncidentModeration'));
    assert.equal(moderation.props.embedded, true);
    if (index === 0) {
      history.props.onOpenVenue('venue-id');
      assert.deepEqual(ui.calls.pop(), ['push', venueFromSettingsHref('venue-id')]);
    }
    rows(tree)[0].props.onPress();
    assert.ok(!nodes(render()).some(node => /History|Moderation/.test(String(node.type))));
    assert.equal(JSON.stringify(ui.catalog), before);
    assert.deepEqual(ui.calls, []);
  }
});

test('embedded history sections remove inner cards and repeated headings while retaining empty states and record children', () => {
  const ui = profileUi();
  const props = { title: 'My language suggestions', icon: 'languages', hint: 'Explanation', emptyHint: 'Suggest a language', embedded: true };
  for (const count of [0, 2]) {
    const child = { type: 'Text', props: { children: 'Pending record and original date' } };
    const tree = ui.rows.ProfileActivitySection({ ...props, count, children: child });
    assert.ok(!nodes(tree).some(node => node.props.children === props.title || node.props.children === props.hint));
    assert.ok(!nodes(tree).some(node => {
      const style = flattenStyle(node.props.style);
      return style.backgroundColor || style.borderWidth || style.padding;
    }));
    assert.ok(nodes(tree).some(node => node.props.children === (count ? child.props.children : 'No activity yet')));
    if (!count) assert.ok(nodes(tree).some(node => node.props.children === props.emptyHint));
  }
});
