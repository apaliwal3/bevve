import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';
import { createAuthStore, authErrorDetails, authErrorMessage } from '../src/features/auth/auth-store.ts';
import { supabaseConfig } from '../src/lib/supabase-config.ts';

const session = { user: { id: 'user-a' }, access_token: 'test-token' };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function client(overrides = {}) {
  let listener;
  let unsubscribed = false;
  return {
    auth: {
      onAuthStateChange(fn) { listener = fn; return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } }; },
      getSession: async () => ({ data: { session }, error: null }),
      signInWithPassword: async () => ({ data: { session }, error: null }),
      signUp: async () => ({ data: { session: null }, error: null }),
      signOut: async () => ({ error: null }),
      ...overrides,
    },
    emit(event, value) { listener(event, value); },
    get unsubscribed() { return unsubscribed; },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('restores the saved session, publishes refresh/sign-out, and unsubscribes on cleanup', async () => {
  const sdk = client();
  const store = createAuthStore(sdk);
  assert.equal(store.getSnapshot().ready, false);
  const stop = store.start();
  await tick();
  assert.equal(store.getSnapshot().session, session);
  const refreshed = { ...session, access_token: 'refreshed-test-token' };
  sdk.emit('TOKEN_REFRESHED', refreshed);
  assert.equal(store.getSnapshot().session, refreshed);
  sdk.emit('SIGNED_OUT', null);
  assert.equal(store.getSnapshot().session, null);
  stop();
  assert.equal(sdk.unsubscribed, true);
  sdk.emit('SIGNED_IN', session);
  assert.equal(store.getSnapshot().session, null);
});

test('a delayed restoration cannot resurrect a session after sign-out', async () => {
  const delayed = deferred();
  const sdk = client({ getSession: () => delayed.promise });
  const store = createAuthStore(sdk);
  store.start();
  sdk.emit('SIGNED_OUT', null);
  delayed.resolve({ data: { session }, error: null });
  await tick();
  assert.equal(store.getSnapshot().session, null);
  assert.equal(store.getSnapshot().ready, true);
});

test('restoration failures finish loading with a recoverable message', async () => {
  const store = createAuthStore(client({ getSession: async () => { throw new Error('storage unavailable'); } }));
  store.start();
  await tick();
  assert.equal(store.getSnapshot().ready, true);
  assert.equal(store.getSnapshot().session, null);
  assert.ok(store.getSnapshot().error);
});

test('failed sign-in leaves the session empty; successful sign-in trims email but preserves password', async () => {
  const error = { code: 'invalid_credentials' };
  const failed = createAuthStore(client({ signInWithPassword: async () => ({ data: { session: null }, error }) }));
  await assert.rejects(failed.signIn('test@example.com', 'password'), received => received === error);
  assert.equal(failed.getSnapshot().session, null);
  let received;
  const store = createAuthStore(client({ signInWithPassword: async values => {
    received = values;
    return { data: { session }, error: null };
  } }));
  await store.signIn(' test@example.com ', ' password ');
  assert.deepEqual(received, { email: 'test@example.com', password: ' password ' });
  assert.equal(store.getSnapshot().session, session);
});

test('signup distinguishes email confirmation from an immediately signed-in account', async () => {
  const unconfirmed = createAuthStore(client());
  assert.equal(await unconfirmed.signUp('test@example.com', 'password', 'Name'), 'confirm-email');
  assert.equal(unconfirmed.getSnapshot().session, null);
  const confirmed = createAuthStore(client({ signUp: async () => ({ data: { session }, error: null }) }));
  assert.equal(await confirmed.signUp('test@example.com', 'password', 'Name'), 'signed-in');
  assert.equal(confirmed.getSnapshot().session, session);
});

test('failed sign-out retains the account; successful sign-out uses local scope and clears the session', async () => {
  const sdk = client({ signOut: async () => ({ error: new Error('offline') }) });
  const store = createAuthStore(sdk);
  await store.signIn('test@example.com', 'password');
  await assert.rejects(store.signOut(), /offline/);
  assert.equal(store.getSnapshot().session, session);
  sdk.auth.signOut = async options => { assert.deepEqual(options, { scope: 'local' }); return { error: null }; };
  await store.signOut();
  assert.equal(store.getSnapshot().session, null);
});

test('missing configuration keeps demo available but cannot authenticate', async () => {
  const store = createAuthStore(null);
  assert.equal(store.getSnapshot().ready, true);
  assert.equal(store.configured, false);
  await assert.rejects(store.signIn('test@example.com', 'password'), /auth_not_configured/);
});

test('public configuration accepts publishable/anon keys and rejects privileged keys', () => {
  const url = 'https://test.supabase.co';
  const jwt = role => 'header.' + Buffer.from(JSON.stringify({ role })).toString('base64url') + '.signature';
  for (const key of ['sb_secret_fake', jwt('service_role'), 'invalid']) assert.equal(supabaseConfig(url, key), null);
  assert.equal(supabaseConfig('not-a-url', 'sb_publishable_test'), null);
  assert.equal(supabaseConfig(undefined, undefined), null);
  assert.equal(supabaseConfig(url, 'sb_publishable_test').url, url);
  assert.equal(supabaseConfig(url, jwt('anon')).url, url);
});

test('configuration rejects service endpoints that would produce incorrect auth paths', () => {
  for (const service of ['rest', 'auth', 'storage', 'functions', 'realtime']) {
    for (const suffix of ['', '/', '/signup']) {
      assert.equal(supabaseConfig(`https://test.supabase.co/${service}/v1${suffix}`, 'sb_publishable_test'), null);
    }
  }
});

test('a configured SDK signup targets the project auth endpoint', async () => {
  const config = supabaseConfig('https://test.supabase.co', 'sb_publishable_test');
  const requests = [];
  const sdk = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (url, init) => {
      requests.push({ url: String(url), method: init.method });
      return new Response(JSON.stringify({ code: 'signup_disabled', msg: 'Test: no account created' }), {
        status: 422, headers: { 'Content-Type': 'application/json' },
      });
    } },
  });
  const { error } = await sdk.auth.signUp({ email: 'test@example.com', password: 'test-password' });
  assert.equal(error.status, 422);
  assert.deepEqual(requests, [{ url: 'https://test.supabase.co/auth/v1/signup', method: 'POST' }]);
});

test('auth errors use safe user-facing messages rather than raw server responses', () => {
  assert.equal(authErrorMessage({ code: 'invalid_credentials' }), 'The email or password is incorrect.');
  assert.equal(authErrorMessage({ code: 'email_not_confirmed' }), 'Confirm your email before signing in.');
  assert.ok(!authErrorMessage(new Error('PRIVATE_DATABASE_DETAIL')).includes('PRIVATE_DATABASE_DETAIL'));
});

test('signup service errors explain the failure without blaming the connection or exposing server details', () => {
  const cases = [
    ['email_address_not_authorized', 'Confirmation emails cannot be sent to this address yet. Please contact support.'],
    ['email_address_invalid', 'This email address is not supported. Try another address.'],
    ['user_already_exists', 'An account with this email already exists. Please sign in.'],
    ['email_exists', 'An account with this email already exists. Please sign in.'],
    ['signup_disabled', 'New email accounts are unavailable right now. Please try again later.'],
    ['email_provider_disabled', 'New email accounts are unavailable right now. Please try again later.'],
    ['captcha_failed', 'Account verification could not be completed. Please contact support.'],
    ['unexpected_failure', 'The account service could not complete this request. Please try again later.'],
  ];
  for (const [code, message] of cases) {
    assert.equal(authErrorMessage({ code, message: 'PRIVATE_DATABASE_DETAIL' }), message);
  }
});

test('auth diagnostics expose only an error category, bounded code and HTTP status', () => {
  assert.deepEqual(authErrorDetails({ name: 'AuthApiError', code: 'unexpected_failure', status: 500, message: 'PRIVATE_DATABASE_DETAIL', password: 'private', access_token: 'private' }), { name: 'AuthApiError', code: 'unexpected_failure', status: 500 });
  assert.deepEqual(authErrorDetails({ name: 'AuthRetryableFetchError', status: 0 }), { name: 'AuthRetryableFetchError', code: 'unknown', status: 0 });
  assert.deepEqual(authErrorDetails(new Error('private')), { name: 'Error', code: 'unknown', status: null });
  for (const value of [null, undefined, 'private', { name: 'private@example.com', code: 'private@example.com', status: 'private' }]) {
    assert.deepEqual(authErrorDetails(value), { name: 'unknown', code: 'unknown', status: null });
  }
});
