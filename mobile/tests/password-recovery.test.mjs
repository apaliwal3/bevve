import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'node:buffer';
import { createAuthStore, authErrorMessage } from '../src/features/auth/auth-store.ts';
import { readPasswordRecoveryLink } from '../src/features/auth/password-recovery-link.ts';
import { validateEmail } from '../src/features/auth/auth-validation.ts';
import * as recovery from '../../shared/password-recovery.ts';
import { elements, loadNativeModule, nativeStub } from './helpers/native-module.mjs';
import { hookHarness } from './helpers/hook-harness.mjs';
import { createTranslator } from '../src/localization/translation.ts';

const link = 'mobile://recover-password#type=recovery&access_token=test-access&refresh_token=test-refresh';
const session = { user: { id: 'user-a', email: 'test@example.com' } };
const values = { newPassword: ' new-password ', confirmPassword: ' new-password ' };
const tick = () => new Promise(resolve => setImmediate(resolve));
function sdk(overrides = {}) {
  let listener;
  return { auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    getUser: async () => ({ data: { user: session.user }, error: null }),
    setSession: async () => ({ data: { session }, error: null }),
    updateUser: async () => ({ data: { user: session.user }, error: null }),
    signOut: async () => ({ error: null }), ...overrides,
  }, emit(event, value) { listener(event, value); } };
}

test('recovery link parser handles native, Expo Go, web, PKCE and error callbacks without accepting unrelated links', () => {
  for (const base of ['mobile://recover-password', 'mobile:///recover-password', 'exp://127.0.0.1:8081/--/recover-password', 'https://bevve.example/recover-password']) {
    assert.deepEqual(readPasswordRecoveryLink(base + '#type=recovery&access_token=test-access&refresh_token=test-refresh'), { access_token: 'test-access', refresh_token: 'test-refresh' });
  }
  assert.deepEqual(readPasswordRecoveryLink('mobile://recover-password?code=test-code'), { code: 'test-code' });
  assert.deepEqual(readPasswordRecoveryLink('mobile://recover-password#error_code=otp_expired'), { error: true });
  for (const value of ['bad url', 'mobile://profile#type=recovery&access_token=x&refresh_token=y', 'mobile://recover-password',
    'mobile://recover-password#type=signup&access_token=x&refresh_token=y', 'javascript:/recover-password?code=x', 'mobile://recover-password#type=recovery&access_token=x']) {
    assert.equal(readPasswordRecoveryLink(value), null);
  }
});

test('a valid email link grants recovery only after session verification and updates without the old password', async () => {
  const calls = [];
  const client = sdk({ setSession: async credentials => { calls.push(credentials); return { data: { session }, error: null }; },
    updateUser: async attributes => { calls.push(attributes); return { data: { user: session.user }, error: null }; } });
  const store = createAuthStore(client);
  const stop = store.start();
  await assert.rejects(store.completePasswordRecovery(values), { code: 'password_recovery_required' });
  const accepting = store.acceptPasswordRecoveryLink(link);
  assert.equal(store.getSnapshot().recovery, 'verifying');
  await accepting;
  assert.equal(store.getSnapshot().recovery, 'ready');
  client.emit('TOKEN_REFRESHED', session);
  await store.completePasswordRecovery(values);
  assert.deepEqual(calls, [{ access_token: 'test-access', refresh_token: 'test-refresh' }, { password: ' new-password ' }]);
  store.finishPasswordRecovery();
  assert.equal(store.getSnapshot().recovery, 'none');
  await assert.rejects(store.completePasswordRecovery(values), { code: 'password_recovery_required' });
  stop();
});

test('expired links, missing tokens, session failures and account changes cannot authorize a password update', async () => {
  const failed = createAuthStore(sdk({ setSession: async () => ({ data: { session: null }, error: { code: 'otp_expired' } }) }));
  await failed.acceptPasswordRecoveryLink(link);
  assert.equal(failed.getSnapshot().recovery, 'error');
  await assert.rejects(failed.completePasswordRecovery(values), { code: 'password_recovery_required' });
  const store = createAuthStore(sdk());
  await store.acceptPasswordRecoveryLink('mobile://recover-password');
  assert.equal(store.getSnapshot().recovery, 'none');
  await store.acceptPasswordRecoveryLink('mobile://recover-password#error=access_denied');
  assert.equal(store.getSnapshot().recovery, 'error');
  const client = sdk(), changing = createAuthStore(client), stop = changing.start();
  await changing.acceptPasswordRecoveryLink(link);
  client.emit('SIGNED_IN', { user: { id: 'other' } });
  assert.equal(changing.getSnapshot().recovery, 'none');
  await assert.rejects(changing.completePasswordRecovery(values), { code: 'password_recovery_required' });
  stop();
});

test('a delayed recovery result cannot reopen a cancelled recovery flow; PKCE codes use the SDK exchange', async () => {
  let resolve;
  const store = createAuthStore(sdk({ setSession: () => new Promise(done => { resolve = done; }) }));
  const accepting = store.acceptPasswordRecoveryLink(link);
  store.finishPasswordRecovery();
  resolve({ data: { session }, error: null }); await accepting;
  assert.equal(store.getSnapshot().recovery, 'none');
  const pkce = createAuthStore(sdk({ exchangeCodeForSession: async code => {
    assert.equal(code, 'test-code'); return { data: { session }, error: null };
  } }));
  await pkce.acceptPasswordRecoveryLink('mobile://recover-password?code=test-code');
  assert.equal(pkce.getSnapshot().recovery, 'ready');
});

test('requesting recovery uses the SDK recover endpoint, trims only email and passes the callback URL', async () => {
  const requests = [];
  const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      requests.push({ url: new URL(url), method: init.method, body: JSON.parse(init.body) });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  await createAuthStore(client).requestPasswordRecovery(' test@example.com ', 'mobile://recover-password');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/auth/v1/recover');
  assert.equal(requests[0].url.searchParams.get('redirect_to'), 'mobile://recover-password');
  assert.equal(requests[0].body.email, 'test@example.com');
});

test('the real SDK verifies email-link tokens then sends only the new password to the authenticated user endpoint', async () => {
  const user = { ...session.user, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = encode({ alg: 'HS256' }) + '.' + encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }) + '.c2lnbmF0dXJl';
  const requests = [];
  const client = createClient('https://test.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, init) => {
      requests.push({ path: new URL(url).pathname, method: init.method, body: init.body ? JSON.parse(init.body) : null, authorization: init.headers.Authorization });
      return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  const store = createAuthStore(client);
  const stop = store.start();
  await store.acceptPasswordRecoveryLink('mobile://recover-password#type=recovery&access_token=' + token + '&refresh_token=test-refresh');
  assert.equal(store.getSnapshot().recovery, 'ready');
  await store.completePasswordRecovery(values);
  assert.deepEqual(requests.map(({ path, method }) => ({ path, method })), [
    { path: '/auth/v1/user', method: 'GET' }, { path: '/auth/v1/user', method: 'GET' }, { path: '/auth/v1/user', method: 'PUT' },
  ]);
  assert.equal(requests[2].body.password, values.newPassword);
  assert.equal(requests[2].body.current_password, undefined);
  assert.equal(requests[2].body.confirmPassword, undefined);
  assert.equal(requests[2].authorization, 'Bearer ' + token);
  stop();
});

function ui(name, overrides = {}) {
  const harness = hookHarness(), calls = [];
  const auth = { recovery: 'ready', session, requestPasswordRecovery: async () => {}, completePasswordRecovery: async () => {}, finishPasswordRecovery() {}, ...overrides };
  const module = loadNativeModule('src/features/auth/password-recovery-screen.tsx', {
    react: harness.react,
    'react-native': { ...nativeStub, KeyboardAvoidingView: 'KeyboardAvoidingView', Platform: { OS: 'ios' } },
    'expo-router': { router: { replace: path => calls.push(path) }, useFocusEffect: fn => harness.react.useEffect(fn, [fn]) },
    'expo-linking': { createURL: () => 'mobile://recover-password' },
    '@/components/flow-header': { FlowHeader: 'FlowHeader' }, '@/components/form-input': { FormInput: 'FormInput' },
    '@/components/primary-button': { PrimaryButton: 'PrimaryButton' }, '@/components/screen-container': { ScreenContainer: 'ScreenContainer' },
    '@/constants/theme': loadNativeModule('src/constants/theme.ts'),
    '@/localization/language-provider': { useTranslation: () => ({ t: createTranslator('en') }) },
    '../../../../shared/password-recovery': recovery,
    './auth-provider': { useAuth: () => auth }, './auth-store': { authErrorMessage }, './auth-validation': { validateEmail },
  });
  const recoveredForm = name === 'RecoverPasswordScreen' ? module.RecoverPasswordScreen() : null;
  function render() {
    const tree = harness.render(() => recoveredForm ? recoveredForm.type(recoveredForm.props) : module.ForgotPasswordScreen());
    harness.effects();
    return [...elements(tree)];
  }
  return { render, harness, calls, auth, change(label, value) { render().find(node => node.type === 'FormInput' && node.props.label === label).props.onChangeText(value); } };
}

test('forgotten-password form validates email, blocks duplicate taps and shows an account-neutral confirmation', async () => {
  let resolve;
  const calls = [], form = ui('ForgotPasswordScreen', { requestPasswordRecovery: (...args) => { calls.push(args); return new Promise(done => { resolve = done; }); } });
  form.render().find(node => node.type === 'PrimaryButton').props.onPress();
  assert.equal(calls.length, 0);
  assert.equal(form.render().find(node => node.type === 'FormInput').props.error, 'Email is required.');
  form.change('Email', 'test@example.com');
  const button = form.render().find(node => node.type === 'PrimaryButton');
  button.props.onPress(); button.props.onPress();
  assert.deepEqual(calls, [['test@example.com', 'mobile://recover-password']]);
  assert.equal(form.render().find(node => node.type === 'FormInput').props.editable, false);
  resolve(); await tick();
  assert.ok(form.render().some(node => node.props.children === 'If an account exists for that email, you will receive a password reset link. Open it to choose a new password.'));
  form.harness.unmount();
});

test('recovery form needs a verified link, validates matching passwords and clears successful drafts', async () => {
  let count = 0;
  const form = ui('RecoverPasswordScreen', { completePasswordRecovery: async draft => { count++; assert.deepEqual({ ...draft }, values); } });
  const fields = form.render().filter(node => node.type === 'FormInput');
  assert.equal(fields.length, 2);
  assert.ok(fields.every(node => node.props.secureTextEntry));
  form.change('New password', values.newPassword);
  form.change('Confirm new password', 'wrong');
  form.render().find(node => node.type === 'PrimaryButton').props.onPress();
  assert.equal(count, 0);
  form.change('Confirm new password', values.confirmPassword);
  form.render().find(node => node.type === 'PrimaryButton').props.onPress();
  await tick();
  assert.equal(count, 1);
  assert.ok(form.render().some(node => node.props.label === 'Continue to Explore'));
  assert.ok(!form.render().some(node => node.type === 'FormInput'));
  form.harness.replayEffects();
  assert.ok(form.render().filter(node => node.type === 'FormInput').every(node => node.props.value === ''));
  form.auth.recovery = 'error';
  assert.ok(!form.render().some(node => node.type === 'FormInput'));
  assert.ok(form.render().some(node => node.props.label === 'Request a new link'));
  form.harness.unmount();
});

test('recovery form blocks duplicate saves, retains failed drafts for retry and ignores results after blur', async () => {
  let reject, calls = 0;
  const form = ui('RecoverPasswordScreen', { completePasswordRecovery: () => { calls++; return new Promise((resolve, fail) => { reject = fail; }); } });
  form.change('New password', values.newPassword); form.change('Confirm new password', values.confirmPassword);
  const button = form.render().find(node => node.type === 'PrimaryButton');
  button.props.onPress(); button.props.onPress();
  assert.equal(calls, 1);
  assert.ok(form.render().filter(node => node.type === 'FormInput').every(node => !node.props.editable));
  reject({ code: 'weak_password' }); await tick();
  assert.ok(form.render().some(node => node.props.accessibilityRole === 'alert' && node.props.children === 'Choose a stronger password and try again.'));
  assert.equal(form.render().find(node => node.props.label === 'New password').props.value, values.newPassword);
  form.render().find(node => node.type === 'PrimaryButton').props.onPress();
  assert.equal(calls, 2);
  form.harness.replayEffects();
  reject(new Error('private detail')); await tick();
  assert.ok(form.render().filter(node => node.type === 'FormInput').every(node => node.props.value === ''));
  assert.ok(!form.render().some(node => node.props.accessibilityRole === 'alert'));
  form.harness.unmount();
});

test('a session expiring during recovery offers a new link rather than requesting the forgotten password', async () => {
  const client = sdk(), store = createAuthStore(client);
  await store.acceptPasswordRecoveryLink(link);
  client.auth.getUser = async () => ({ data: { user: null }, error: { code: 'session_not_found' } });
  await assert.rejects(store.completePasswordRecovery(values), { code: 'password_recovery_required' });
  assert.equal(store.getSnapshot().recovery, 'error');
});

test('recovery provider receives cold and warm links and removes the listener on cleanup', async () => {
  const harness = hookHarness(), accepted = [];
  let listener, removed = false;
  const store = { start: () => () => {}, subscribe() {}, getSnapshot: () => ({ session: null }), getServerSnapshot() {},
    acceptPasswordRecoveryLink: async url => accepted.push(url) };
  const module = loadNativeModule('src/features/auth/auth-provider.tsx', {
    react: { ...harness.react, createContext: () => ({ Provider: 'Provider' }), useSyncExternalStore: (_subscribe, get) => get() },
    'react-native': { ...nativeStub, Platform: { OS: 'web' } },
    'expo-linking': { getInitialURL: async () => link, addEventListener: (_event, callback) => { listener = callback; return { remove() { removed = true; } }; } },
    '@/lib/supabase': { supabase: null }, './auth-store': { createAuthStore: () => store },
  });
  harness.render(() => module.AuthProvider({})); harness.effects(); await tick();
  listener({ url: 'mobile://recover-password?code=warm' });
  assert.deepEqual(accepted, [link, 'mobile://recover-password?code=warm']);
  harness.unmount();
  assert.equal(removed, true);
});
