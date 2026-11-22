import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import * as state from '../src/features/auth/auth-form-state.ts';
import * as validation from '../src/features/auth/auth-validation.ts';
import { authErrorMessage } from '../src/features/auth/auth-store.ts';

const theme = loadNativeModule('src/constants/theme.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(mode, overrides) {
  const harness = hookHarness();
  const navigations = [];
  const auth = { session: null, error: null, signIn: async () => {}, signUp: async () => 'confirm-email', ...overrides };
  const screen = loadNativeModule('src/features/auth/auth-screen.tsx', {
    react: harness.react,
    'react-native': { ...nativeStub, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' } },
    'expo-router': { router: { replace: route => navigations.push(route) }, useFocusEffect: fn => harness.react.useEffect(fn, [fn]) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator('en') }) },
    '@/components/app-icon': { AppIcon: 'AppIcon' },
    '@/components/form-input': { FormInput: 'FormInput' },
    '@/components/logo': { Logo: 'Logo' },
    '@/components/primary-button': { PrimaryButton: 'PrimaryButton' },
    '@/components/screen-container': { ScreenContainer: 'ScreenContainer' },
    '@/constants/theme': theme,
    './auth-form-state': state, './auth-validation': validation,
    './auth-provider': { useAuth: () => auth }, './auth-store': { authErrorMessage },
  });
  function render() {
    let tree;
    for (let i = 0; i < 10; i++) {
      tree = harness.render(() => screen.AuthScreen({ mode, onBack() {}, onSwitch() {} }));
      harness.effects();
      if (!harness.dirty) break;
    }
    return [...elements(tree)];
  }
  function fill() {
    for (const [label, value] of [['Username', 'Test Name'], ['Email', 'test@example.com'], ['Password', 'password123']]) {
      render().find(node => node.type === 'FormInput' && node.props.label === label)?.props.onChangeText(value);
    }
  }
  return { render, fill, harness, navigations };
}

test('Login sends one request on rapid taps, disables inputs, and opens Profile on success', async () => {
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const calls = [];
  const ui = setup('login', { signIn: (...args) => { calls.push(args); return pending; } });
  ui.fill();
  const button = ui.render().find(node => node.type === 'PrimaryButton');
  button.props.onPress();
  button.props.onPress();
  assert.deepEqual(calls, [['test@example.com', 'password123']]);
  assert.ok(ui.render().filter(node => node.type === 'FormInput').every(node => node.props.editable === false));
  assert.equal(ui.render().find(node => node.type === 'FormInput' && node.props.label === 'Password').props.value, '');
  resolve();
  await tick();
  assert.deepEqual(ui.navigations, ['/profile']);
  ui.harness.unmount();
});

test('Signup without a session asks for email confirmation and does not navigate as authenticated', async () => {
  const ui = setup('signup');
  ui.fill();
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  await tick();
  assert.deepEqual(ui.navigations, []);
  assert.ok(ui.render().some(node => node.props.children === 'Check your email to confirm your account, then return here to sign in.'));
  assert.ok(ui.render().filter(node => node.type === 'FormInput').every(node => node.props.value === ''));
  ui.harness.unmount();
});

test('failed Login shows an error and allows retry without restoring the password', async () => {
  const ui = setup('login', { signIn: async () => { throw { code: 'invalid_credentials' }; } });
  ui.fill();
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  await tick();
  const nodes = ui.render();
  assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert' && node.props.children === 'The email or password is incorrect.'));
  assert.equal(nodes.find(node => node.type === 'PrimaryButton').props.disabled, false);
  assert.equal(nodes.find(node => node.type === 'FormInput' && node.props.label === 'Password').props.value, '');
  assert.deepEqual(ui.navigations, []);
  ui.harness.unmount();
});

test('a late request response cannot navigate after leaving the authentication screen', async () => {
  let resolve;
  const ui = setup('login', { signIn: () => new Promise(done => { resolve = done; }) });
  ui.fill();
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  ui.harness.unmount();
  resolve();
  await tick();
  assert.deepEqual(ui.navigations, []);
});
