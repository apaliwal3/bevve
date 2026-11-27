import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js';
import { authService } from '../src/services/auth.ts';
import { result } from '../src/services/shared.ts';
import { safetyService } from '../src/services/safety.ts';
import { validatePasswordReset } from '../../shared/password-reset.ts';

const passwordValues = { currentPassword: ' old password ', newPassword: ' new password ', confirmPassword: ' new password ' };
function passwordClient(overrides = {}) {
  const calls: unknown[] = [];
  const user = { id: 'user-a', email: 'test@example.com' };
  const auth = {
    getUser: async () => ({ data: { user }, error: null }),
    signInWithPassword: async (values: unknown) => { calls.push(['verify', values]); return { data: { user, session: { user } }, error: null }; },
    updateUser: async (values: unknown) => { calls.push(['update', values]); return { data: { user }, error: null }; },
    ...overrides,
  };
  return { calls, service: authService({ auth } as unknown as SupabaseClient) };
}

test('password reset verifies the authenticated account before updating, preserving exact password bytes', async () => {
  const { service, calls } = passwordClient();
  await service.resetPassword(passwordValues);
  assert.deepEqual(calls, [
    ['verify', { email: 'test@example.com', password: passwordValues.currentPassword }],
    ['update', { password: passwordValues.newPassword, current_password: passwordValues.currentPassword }],
  ]);
});

test('password reset rejects invalid drafts before making any auth requests', async () => {
  const { service } = passwordClient({ getUser() { assert.fail('must validate before contacting Auth'); } });
  for (const patch of [{ currentPassword: '' }, { newPassword: 'short', confirmPassword: 'short' },
    { newPassword: '      ', confirmPassword: '      ' }, { confirmPassword: 'different' },
    { newPassword: passwordValues.currentPassword, confirmPassword: passwordValues.currentPassword }]) {
    await assert.rejects(service.resetPassword({ ...passwordValues, ...patch }), { code: 'invalid_password_reset' });
  }
  assert.deepEqual(validatePasswordReset(passwordValues), {});
  assert.ok(validatePasswordReset({ ...passwordValues, confirmPassword: passwordValues.newPassword.trim() }).confirmPassword);
});

test('an incorrect current password prevents password updates', async () => {
  const { service, calls } = passwordClient({ signInWithPassword: async () => ({ data: { user: null, session: null },
    error: new AuthApiError('Private detail', 400, 'invalid_credentials') }) });
  await assert.rejects(service.resetPassword(passwordValues), { code: 'current_password_incorrect' });
  assert.deepEqual(calls, []);
});

test('password reset requires a verified user and a fresh session for the same account', async () => {
  for (const overrides of [
    { getUser: async () => ({ data: { user: null }, error: null }) },
    { signInWithPassword: async () => ({ data: { user: { id: 'other' }, session: {} }, error: null }) },
    { signInWithPassword: async () => ({ data: { user: { id: 'user-a' }, session: null }, error: null }) },
  ]) {
    const { service, calls } = passwordClient(overrides);
    await assert.rejects(service.resetPassword(passwordValues), { code: 'session_not_found' });
    assert.deepEqual(calls, []);
  }
});

test('password reset propagates policy and network failures instead of reporting success', async () => {
  const error = new AuthApiError('Private detail', 422, 'weak_password');
  for (const overrides of [
    { getUser: async () => ({ data: { user: null }, error }) },
    { signInWithPassword: async () => { throw error; } },
    { updateUser: async () => ({ data: { user: null }, error }) },
  ]) {
    await assert.rejects(passwordClient(overrides).service.resetPassword(passwordValues), received => received === error);
  }
});

test('forgotten-password service sends recovery mail without requiring a session or revealing account existence', async () => {
  const calls: unknown[] = [];
  const client = { auth: { resetPasswordForEmail: async (email: string, options: unknown) => {
    calls.push([email, options]); return { data: {}, error: null };
  } } } as unknown as SupabaseClient;
  const service = authService(client);
  await service.requestPasswordRecovery(' test@example.com ', 'mobile://recover-password');
  assert.deepEqual(calls, [['test@example.com', { redirectTo: 'mobile://recover-password' }]]);
  await assert.rejects(service.requestPasswordRecovery('invalid', 'mobile://recover-password'), /invalid_recovery_email/);
  await assert.rejects(service.requestPasswordRecovery('test@example.com', 'javascript:alert(1)'), /invalid_recovery_redirect/);
  assert.equal(calls.length, 1);
});

test('email recovery updates the authenticated account without a current password and propagates password policy errors', async () => {
  const calls: unknown[] = [];
  const user = { id: 'user-a' };
  const client = { auth: { getUser: async () => ({ data: { user }, error: null }),
    updateUser: async (attributes: unknown) => { calls.push(attributes); return { data: { user }, error: null }; } } } as unknown as SupabaseClient;
  const values = { newPassword: ' recovered password ', confirmPassword: ' recovered password ' };
  await authService(client).completePasswordRecovery(values);
  assert.deepEqual(calls, [{ password: values.newPassword }]);
  const policyError = new AuthApiError('private policy detail', 422, 'weak_password');
  client.auth.updateUser = async () => ({ data: { user: null }, error: policyError });
  await assert.rejects(authService(client).completePasswordRecovery(values), received => received === policyError);
  await assert.rejects(authService(client).completePasswordRecovery({ ...values, confirmPassword: 'wrong' }), /invalid_password_reset/);
});

test('forgotten-password email failures and missing recovery sessions do not report success', async () => {
  const error = new AuthApiError('private server detail', 429, 'over_email_send_rate_limit');
  const client = { auth: {
    resetPasswordForEmail: async () => ({ data: null, error }),
    getUser: async () => ({ data: { user: null }, error: null }),
    updateUser() { assert.fail('must not update without an authenticated recovery session'); },
  } } as unknown as SupabaseClient;
  await assert.rejects(authService(client).requestPasswordRecovery('test@example.com', 'mobile://recover-password'), received => received === error);
  await assert.rejects(authService(client).completePasswordRecovery({ newPassword: 'new-password', confirmPassword: 'new-password' }), /Sign in first/);
});

test('sign-in rejects Supabase auth errors instead of returning a null user', async () => {
  const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials');
  const client = {
    auth: { signInWithPassword: async () => ({ data: { user: null, session: null }, error }) },
  } as unknown as SupabaseClient;

  await assert.rejects(authService(client).signIn('test@example.com', 'wrong-password'),
    (received: unknown) => received === error);
});

test('result accepts both branches of an auth-style response and returns success data', async () => {
  type Response =
    | { data: { user: { id: string } }; error: null }
    | { data: { user: null }; error: Error };
  const request: Promise<Response> = Promise.resolve({ data: { user: { id: 'user-a' } }, error: null });
  assert.deepEqual(await result(request), { user: { id: 'user-a' } });
});

test('result preserves valid empty query responses and propagates request failures', async () => {
  assert.equal(await result(Promise.resolve({ data: null, error: null })), null);
  const error = new Error('Network unavailable');
  await assert.rejects(result(Promise.reject(error)), (received: unknown) => received === error);
});

test('safety service explicitly scopes personal report history to the current reporter, including moderators', async () => {
  const owner = '20000000-0000-4000-8000-000000000001';
  const filters: unknown[] = [];
  const query = { select() { return query; }, eq(column: string, value: string) { filters.push([column, value]); return query; },
    order() { return query; }, async range() { return { data: [], error: null }; } };
  const client = { auth: { getUser: async () => ({ data: { user: { id: owner } }, error: null }) },
    from(table: string) { assert.equal(table, 'incident_reports'); return query; } } as unknown as SupabaseClient;
  assert.deepEqual(await safetyService(client).getMyIncidentReports(), []);
  assert.deepEqual(filters, [['reporter_id', owner]]);
});
