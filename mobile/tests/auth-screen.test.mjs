import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hookHarness } from './helpers/hook-harness.mjs';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { createTranslator } from '../src/localization/translation.ts';
import * as state from '../src/features/auth/auth-form-state.ts';
import * as validation from '../src/features/auth/auth-validation.ts';
import { authErrorDetails, authErrorMessage } from '../src/features/auth/auth-store.ts';

const theme = loadNativeModule('src/constants/theme.ts');
const tick = () => new Promise(resolve => setImmediate(resolve));
function setup(mode, overrides, globals = {}) {
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
    './auth-provider': { useAuth: () => auth }, './auth-store': { authErrorDetails, authErrorMessage },
  }, globals);
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

test('Login sends one request on rapid taps, disables inputs, and opens Explore on success', async () => {
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
  assert.equal(ui.render().find(node => node.type === 'FormInput' && node.props.label === 'Password').props.value, 'password123');
  resolve();
  await tick();
  assert.deepEqual(ui.navigations, ['/explore']);
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

test('failed Login shows an error and retains the password for retry', async () => {
  const ui = setup('login', { signIn: async () => { throw { code: 'invalid_credentials' }; } });
  ui.fill();
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  await tick();
  const nodes = ui.render();
  assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert' && node.props.children === 'The email or password is incorrect.'));
  assert.equal(nodes.find(node => node.type === 'PrimaryButton').props.disabled, false);
  assert.equal(nodes.find(node => node.type === 'FormInput' && node.props.label === 'Password').props.value, 'password123');
  assert.deepEqual(ui.navigations, []);
  ui.harness.unmount();
});

test('Signup preserves the password through a failed request and retries successfully without retyping', async () => {
  const calls = [];
  let reject;
  const ui = setup('signup', {
    signUp: (...args) => {
      calls.push(args);
      return calls.length === 1
        ? new Promise((resolve, fail) => { reject = fail; })
        : Promise.resolve('confirm-email');
    },
  });
  ui.fill();
  const password = ' password123 ';
  ui.render().find(node => node.type === 'FormInput' && node.props.label === 'Password').props.onChangeText(password);
  const button = ui.render().find(node => node.type === 'PrimaryButton');
  button.props.onPress();
  button.props.onPress();
  let nodes = ui.render();
  assert.equal(calls.length, 1);
  assert.equal(nodes.find(node => node.type === 'FormInput' && node.props.label === 'Password').props.value, password);
  assert.ok(nodes.filter(node => node.type === 'FormInput').every(node => node.props.editable === false));
  reject(new Error('Network request failed'));
  await tick();
  nodes = ui.render();
  assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert'));
  assert.equal(nodes.find(node => node.type === 'FormInput' && node.props.label === 'Password').props.value, password);
  assert.equal(nodes.find(node => node.type === 'PrimaryButton').props.disabled, false);
  nodes.find(node => node.type === 'PrimaryButton').props.onPress();
  await tick();
  assert.deepEqual(calls, [
    ['test@example.com', password, 'Test Name'],
    ['test@example.com', password, 'Test Name'],
  ]);
  nodes = ui.render();
  assert.ok(nodes.some(node => node.props.children === 'Check your email to confirm your account, then return here to sign in.'));
  assert.ok(nodes.filter(node => node.type === 'FormInput').every(node => node.props.value === ''));
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

test('Signup explains email delivery restrictions and logs only safe diagnostics in development', async () => {
  const logs = [];
  const ui = setup('signup', { signUp: async () => {
    throw { name: 'AuthApiError', code: 'email_address_not_authorized', status: 403, message: 'PRIVATE_SERVER_DETAIL' };
  } }, { __DEV__: true, console: { warn: (...args) => logs.push(args) } });
  ui.fill();
  ui.render().find(node => node.type === 'PrimaryButton').props.onPress();
  await tick();
  assert.ok(ui.render().some(node => node.props.accessibilityRole === 'alert' && node.props.children === 'Confirmation emails cannot be sent to this address yet. Please contact support.'));
  assert.equal(JSON.stringify(logs), JSON.stringify([['[auth] Request failed', { operation: 'signup', name: 'AuthApiError', code: 'email_address_not_authorized', status: 403 }]]));
  assert.deepEqual(ui.navigations, []);
  ui.harness.unmount();
});
