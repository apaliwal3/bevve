import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { profileUi } from './helpers/profile-ui.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import { authErrorMessage } from '../src/features/auth/auth-store.ts';
import * as validation from '../../shared/password-reset.ts';
import * as navigation from '../src/features/profile/profile-navigation.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(resetPassword = async () => {}, session = { user: { id: 'user-a' } }) {
  const harness = hookHarness();
  const module = loadNativeModule('src/features/auth/reset-password-screen.tsx', {
    react: harness.react,
    'react-native': { ...nativeStub, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' } },
    'expo-router': { router: {}, useFocusEffect: fn => harness.react.useEffect(fn, [fn]) },
    '@/components/form-input': { FormInput: 'FormInput' },
    '@/components/primary-button': { PrimaryButton: 'PrimaryButton' },
    '@/constants/theme': loadNativeModule('src/constants/theme.ts'),
    '@/features/profile/profile-secondary-screen': { ProfileSecondaryScreen: 'ProfileSecondaryScreen' },
    '@/features/profile/profile-navigation': navigation,
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator('en') }) },
    '../../../../shared/password-reset': validation,
    './auth-provider': { useAuth: () => ({ session, resetPassword }) },
    './auth-store': { authErrorMessage },
  });
  const route = loadNativeModule('src/app/change-password.tsx', {
    '@/features/auth/reset-password-screen': module,
  });
  const form = route.default();
  function render() {
    const tree = harness.render(() => form.type(form.props));
    harness.effects();
    return [...elements(tree)];
  }
  function fill() {
    for (const [label, value] of [['Current password', ' old password '], ['New password', ' new password '], ['Confirm new password', ' new password ']]) {
      render().find(node => node.type === 'FormInput' && node.props.label === label).props.onChangeText(value);
    }
  }
  return { render, fill, harness };
}

test('profile has one Change Password action and no retired Edit Profile or duplicate reset action', () => {
  const props = { activity: { impressions: [], crowds: [], bathrooms: [], prices: [] }, onOpenVenue() {}, onWelcome() {} };
  const demo = profileUi();
  assert.ok(![...elements(demo.render(props).props.header)].some(node => node.props.label === 'Reset password'));
  const account = profileUi('en', { auth: { session: { user: { id: 'user-a' } } } });
  const header = [...elements(account.render(props).props.header)];
  const buttons = header.filter(node => node.props.label === 'Change Password');
  assert.equal(buttons.length, 1);
  assert.ok(!header.some(node => ['Edit Profile', 'Reset password'].includes(node.props.label)));
  const button = buttons[0];
  button.props.onPress();
  assert.deepEqual(account.calls, [['push', '/change-password']]);
});

test('password form validates before requesting and demo deep links cannot submit', () => {
  const ui = setup(() => assert.fail('invalid values must not submit'));
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  const fields = ui.render().filter(node => node.type === 'FormInput');
  assert.equal(fields.length, 3);
  assert.ok(fields.every(node => node.props.error && node.props.secureTextEntry));
  const guest = setup(undefined, null);
  assert.ok(!guest.render().some(node => node.type === 'FormInput' || node.type === 'PrimaryButton'));
  ui.harness.unmount(); guest.harness.unmount();
});

test('password form blocks duplicate submissions, locks fields, and clears credentials on success', async () => {
  let resolve;
  const calls = [];
  const ui = setup(values => { calls.push(values); return new Promise(done => { resolve = done; }); });
  ui.fill();
  const button = ui.render().find(node => node.type === 'PrimaryButton');
  button.props.onPress(); button.props.onPress();
  assert.equal(calls.length, 1);
  assert.deepEqual({ ...calls[0] }, { currentPassword: ' old password ', newPassword: ' new password ', confirmPassword: ' new password ' });
  assert.ok(ui.render().filter(node => node.type === 'FormInput').every(node => !node.props.editable));
  resolve(); await tick();
  const nodes = ui.render();
  assert.ok(nodes.some(node => node.props.children === 'Your password has been updated. Use your new password next time you sign in.'));
  assert.ok(!nodes.some(node => node.type === 'FormInput'));
  ui.harness.replayEffects();
  assert.ok(ui.render().filter(node => node.type === 'FormInput').every(node => node.props.value === ''));
  ui.harness.unmount();
});

test('password form keeps failed drafts for retry and clears them on blur, ignoring late results', async () => {
  let reject;
  const ui = setup(() => new Promise((resolve, fail) => { reject = fail; }));
  ui.fill();
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  reject({ code: 'current_password_incorrect' }); await tick();
  assert.ok(ui.render().some(node => node.props.accessibilityRole === 'alert' && node.props.children === 'Your current password is incorrect.'));
  assert.equal(ui.render().find(node => node.props.label === 'Current password').props.value, ' old password ');
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  ui.harness.replayEffects();
  reject({ code: 'weak_password' }); await tick();
  const nodes = ui.render();
  assert.ok(nodes.filter(node => node.type === 'FormInput').every(node => node.props.value === ''));
  assert.ok(!nodes.some(node => node.props.accessibilityRole === 'alert'));
  ui.harness.unmount();
});
