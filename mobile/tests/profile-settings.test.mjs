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

test('Profile replaces Edit Profile with Change Password while preserving action styles and the settings target', () => {
  const ui = profileUi();
  const tree = ui.render({ activity: { impressions: [], crowds: [], bathrooms: [], prices: [] }, onOpenVenue() {}, onWelcome() {} });
  const header = nodes(tree.props.header);
  assert.ok(!header.some(node => node.props.label === 'Edit Profile'));
  assert.equal(existsSync(new URL('../src/app/edit-profile.tsx', import.meta.url)), false);
  assert.equal(profileDestinations.edit, undefined);
  const password = header.find(node => node.props.label === 'Change Password');
  const exit = header.find(node => node.props.label === 'Return to Welcome');
  assert.equal(password.props.style, exit.props.style);
  assert.equal(password.props.variant, exit.props.variant);
  password.props.onPress();
  assert.deepEqual(ui.calls.pop(), ['push', '/change-password']);
  const settings = header.find(node => node.props.accessibilityLabel === 'Settings');
  assert.equal(settings.props.accessibilityRole, 'button');
  assert.ok(flattenStyle(settings.props.style).minHeight >= 44);
  assert.equal(nodes(settings).find(node => node.type === 'AppIcon').props.name, 'settings');
  settings.props.onPress();
  assert.deepEqual(ui.calls.pop(), ['push', '/settings']);
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
    assert.equal(header.props.backLabel, 'Back to Profile');
    header.props.onBack();
    assert.deepEqual(ui.calls, canGoBack ? ['back'] : [['replace', '/profile']]);
  }
  // Lock the dependency boundary as well as the rendered no-input behavior.
  const source = readFileSync(new URL('../src/app/change-password.tsx', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/from '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(imports, ['react-native', '@/constants/theme', '@/features/profile/profile-secondary-screen', '@/localization/language-provider']);
});

function settingsUi(mode = 'account') {
  const ui = profileUi();
  const catalog = { mode, userId: 'owner', venues: [], impressions: {} };
  const module = loadNativeModule('src/app/settings.tsx', {
    ...ui.mocks,
    react: { useState: forbidden },
    '@/features/catalog/catalog-provider': { useVenueCatalog: () => catalog },
    '@/features/contributions/account-language-panel': { AccountLanguageHistory: 'AccountLanguageHistory', AccountLanguageModeration: 'AccountLanguageModeration' },
    '@/features/contributions/account-safety-panel': { AccountIncidentHistory: 'AccountIncidentHistory', AccountIncidentModeration: 'AccountIncidentModeration' },
  });
  const route = module.default();
  const tools = nodes(route).find(node => typeof node.type === 'function');
  return { ...ui, catalog, route, tools };
}

test('Settings removes language preferences and duplicate password actions in both modes; demo exposes no private histories', () => {
  for (const mode of ['demo', 'account']) {
    const ui = settingsUi(mode);
    assert.equal(ui.route.props.title, 'Settings');
    const source = readFileSync(new URL('../src/app/settings.tsx', import.meta.url), 'utf8');
    assert.ok(!/App language|English|Italian|setLanguage|Change Password/.test(source));
    if (mode === 'demo') {
      assert.equal(ui.tools, undefined);
      assert.ok(nodes(ui.route).some(node => node.props.children === 'Sign in to view your account tools.'));
      assert.ok(!nodes(ui.route).some(node => /Account.*History|Account.*Moderation/.test(String(node.type))));
    } else {
      assert.equal(ui.tools.props.catalog, ui.catalog);
      // A different signed-in user remounts the disclosures with private details closed.
      assert.equal(ui.tools.key, ui.catalog.userId);
    }
  }
});

test('compact Settings disclosures open and close existing owner histories and role-gated moderation without changing records', () => {
  const ui = settingsUi();
  const tools = ui.tools.type(ui.tools.props);
  const sections = nodes(tools).filter(node => typeof node.type === 'function');
  assert.deepEqual(sections.map(node => node.props.label), ['My language suggestions', 'My private incident reports']);
  for (const [index, section] of sections.entries()) {
    const harness = hookHarness();
    const module = loadNativeModule('src/app/settings.tsx', {
      ...ui.mocks, react: harness.react,
      '@/features/catalog/catalog-provider': { useVenueCatalog: () => ui.catalog },
      '@/features/contributions/account-language-panel': { AccountLanguageHistory: 'AccountLanguageHistory', AccountLanguageModeration: 'AccountLanguageModeration' },
      '@/features/contributions/account-safety-panel': { AccountIncidentHistory: 'AccountIncidentHistory', AccountIncidentModeration: 'AccountIncidentModeration' },
    });
    const loadedTools = nodes(module.default()).find(node => typeof node.type === 'function');
    const loadedSection = nodes(loadedTools.type(loadedTools.props)).filter(node => typeof node.type === 'function')[index];
    const render = () => harness.render(() => loadedSection.type(loadedSection.props));
    const before = JSON.stringify(ui.catalog);
    let tree = render(), row = nodes(tree).find(node => node.type === 'Pressable');
    assert.equal(row.props.accessibilityLabel, section.props.label);
    assert.equal(row.props.accessibilityState.expanded, false);
    assert.ok(flattenStyle(row.props.style({ pressed: false })).minHeight >= 44);
    assert.ok(!nodes(tree).some(node => /History|Moderation/.test(String(node.type))));
    const label = nodes(row).find(node => node.type === 'Text');
    assert.equal(label.props.numberOfLines, undefined);
    assert.equal(flattenStyle(label.props.style).height, undefined);
    row.props.onPress(); tree = render();
    assert.equal(nodes(tree).find(node => node.type === 'Pressable').props.accessibilityState.expanded, true);
    const history = nodes(tree).find(node => node.type === (index === 0 ? 'AccountLanguageHistory' : 'AccountIncidentHistory'));
    assert.equal(history.props.catalog, ui.catalog);
    assert.ok(nodes(tree).some(node => node.type === (index === 0 ? 'AccountLanguageModeration' : 'AccountIncidentModeration')));
    if (index === 0) {
      history.props.onOpenVenue('venue-id');
      assert.deepEqual(ui.calls.pop(), ['push', venueFromSettingsHref('venue-id')]);
    }
    nodes(tree).find(node => node.type === 'Pressable').props.onPress();
    assert.ok(!nodes(render()).some(node => /History|Moderation/.test(String(node.type))));
    assert.equal(JSON.stringify(ui.catalog), before);
    assert.deepEqual(ui.calls, []);
    harness.unmount();
  }
});
