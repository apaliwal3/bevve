import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js';
import { authService } from '../src/services/auth.ts';
import { result } from '../src/services/shared.ts';

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
