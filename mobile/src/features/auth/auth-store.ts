import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { resetAccountPassword, type PasswordResetValues } from '../../../../shared/password-reset.ts';
import { recoveryError, requestPasswordRecovery, updateRecoveredPassword, type RecoveredPasswordValues } from '../../../../shared/password-recovery.ts';
import { readPasswordRecoveryLink } from './password-recovery-link.ts';

export type AuthSnapshot = {
  session: Session | null;
  ready: boolean;
  error: 'Your session could not be restored. Please sign in again.' | null;
  recovery: 'none' | 'verifying' | 'ready' | 'error';
};

// Keep sessions out of form drafts, navigation params, and application logs.
export function createAuthStore(client: SupabaseClient | null) {
  let snapshot: AuthSnapshot = { session: null, ready: !client, error: null, recovery: 'none' };
  let recoveryUserId: string | null = null;
  let recoveryAttempt = 0;
  const listeners = new Set<() => void>();
  let revision = 0;
  function publish(next: Omit<AuthSnapshot, 'recovery'> & { recovery?: AuthSnapshot['recovery'] }) {
    revision++;
    snapshot = { ...next, recovery: next.recovery ?? snapshot.recovery };
    if (snapshot.recovery === 'none') recoveryUserId = null;
    listeners.forEach(listener => listener());
  }
  function requireClient() {
    if (!client) throw new Error('auth_not_configured');
    return client;
  }
  return {
    configured: Boolean(client),
    getSnapshot: () => snapshot,
    getServerSnapshot: (): AuthSnapshot => serverSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() {
      if (!client) return () => {};
      let active = true;
      const startingRevision = revision;
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (active) publish({ session, ready: true, error: null,
          recovery: event === 'SIGNED_OUT' || (snapshot.recovery === 'ready' && session?.user.id !== recoveryUserId) ? 'none' : snapshot.recovery });
      });
      void client.auth.getSession().then(({ data, error }) => {
        // A newer sign-in/sign-out must win over a delayed restoration response.
        if (!active || revision !== startingRevision) return;
        publish({ session: error ? null : data.session, ready: true,
          error: error ? 'Your session could not be restored. Please sign in again.' : null });
      }).catch(() => {
        if (active && revision === startingRevision) publish({ session: null, ready: true,
          error: 'Your session could not be restored. Please sign in again.' });
      });
      return () => { active = false; subscription.unsubscribe(); };
    },
    async signIn(email: string, password: string) {
      recoveryAttempt++;
      if (snapshot.recovery !== 'none') publish({ ...snapshot, recovery: 'none' });
      const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error('auth_session_missing');
      publish({ session: data.session, ready: true, error: null, recovery: 'none' });
    },
    async signUp(email: string, password: string, username: string) {
      recoveryAttempt++;
      if (snapshot.recovery !== 'none') publish({ ...snapshot, recovery: 'none' });
      const { data, error } = await requireClient().auth.signUp({ email: email.trim(), password,
        options: { data: { username: username.trim() } } });
      if (error) throw error;
      if (data.session) publish({ session: data.session, ready: true, error: null, recovery: 'none' });
      return data.session ? 'signed-in' as const : 'confirm-email' as const;
    },
    requestPasswordRecovery(email: string, redirectTo: string) {
      return requestPasswordRecovery(requireClient(), email, redirectTo);
    },
    async acceptPasswordRecoveryLink(url: string) {
      const credentials = readPasswordRecoveryLink(url);
      if (!credentials || snapshot.recovery === 'verifying') return;
      const request = ++recoveryAttempt;
      publish({ ...snapshot, ready: true, recovery: 'verifying' });
      try {
        if ('error' in credentials) throw recoveryError();
        const sdk = requireClient();
        const response = 'code' in credentials ? await sdk.auth.exchangeCodeForSession(credentials.code) : await sdk.auth.setSession(credentials);
        if (request !== recoveryAttempt) return;
        if (response.error) throw response.error;
        if (!response.data.session) throw recoveryError();
        recoveryUserId = response.data.session.user.id;
        publish({ session: response.data.session, ready: true, error: null, recovery: 'ready' });
      } catch {
        if (request !== recoveryAttempt) return;
        recoveryUserId = null;
        publish({ ...snapshot, ready: true, recovery: 'error' });
      }
    },
    async completePasswordRecovery(values: RecoveredPasswordValues) {
      if (snapshot.recovery !== 'ready' || !recoveryUserId || snapshot.session?.user.id !== recoveryUserId) throw recoveryError();
      try { await updateRecoveredPassword(requireClient(), values, recoveryUserId); }
      catch (error) {
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        if (['session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'bad_jwt', 'password_recovery_required'].includes(String(code))) {
          recoveryUserId = null;
          publish({ ...snapshot, recovery: 'error' });
          throw recoveryError();
        }
        throw error;
      }
    },
    finishPasswordRecovery() { recoveryAttempt++; publish({ ...snapshot, recovery: 'none' }); },
    async resetPassword(values: PasswordResetValues) {
      const sdk = requireClient();
      const userId = snapshot.session?.user.id;
      if (!userId) throw Object.assign(new Error('session_not_found'), { code: 'session_not_found' });
      await resetAccountPassword(sdk, values, userId);
    },
    async signOut() {
      recoveryAttempt++;
      if (snapshot.recovery !== 'none') publish({ ...snapshot, recovery: 'none' });
      const { error } = await requireClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      publish({ session: null, ready: true, error: null, recovery: 'none' });
    },
  };
}

const serverSnapshot: AuthSnapshot = { session: null, ready: false, error: null, recovery: 'none' };

// Log only an error category/code/status, never credentials or raw server messages.
export function authErrorDetails(error: unknown) {
  const value = error && typeof error === 'object' ? error : {};
  const code = 'code' in value ? value.code : null;
  const status = 'status' in value ? value.status : null;
  const name = 'name' in value ? value.name : null;
  return {
    name: typeof name === 'string' && ['AuthApiError', 'AuthRetryableFetchError', 'AuthUnknownError', 'TypeError', 'Error'].includes(name) ? name : 'unknown',
    code: typeof code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(code) ? code : 'unknown',
    status: typeof status === 'number' && Number.isInteger(status) && (status === 0 || (status >= 100 && status <= 599)) ? status : null,
  };
}

export function authErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'invalid_credentials') return 'The email or password is incorrect.' as const;
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in.' as const;
  if (code === 'weak_password') return 'Choose a stronger password and try again.' as const;
  if (code === 'current_password_incorrect') return 'Your current password is incorrect.' as const;
  if (code === 'same_password') return 'Choose a different password.' as const;
  if (code === 'password_recovery_required' || code === 'otp_expired') return 'This reset link is invalid or has expired. Request a new link.' as const;
  if (code === 'session_not_found' || code === 'session_expired' || code === 'refresh_token_not_found') return 'Please sign in again to reset your password.' as const;
  if (code === 'reauthentication_needed' || code === 'reauthentication_not_valid') return 'Please sign in again to reset your password.' as const;
  if (code === 'email_address_not_authorized') {
    return 'Confirmation emails cannot be sent to this address yet. Please contact support.' as const;
  }
  if (code === 'email_address_invalid') return 'This email address is not supported. Try another address.' as const;
  if (code === 'user_already_exists' || code === 'email_exists') return 'An account with this email already exists. Please sign in.' as const;
  if (code === 'signup_disabled' || code === 'email_provider_disabled') return 'New email accounts are unavailable right now. Please try again later.' as const;
  if (code === 'captcha_failed') return 'Account verification could not be completed. Please contact support.' as const;
  if (code === 'unexpected_failure') return 'The account service could not complete this request. Please try again later.' as const;
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Too many attempts. Please wait a little and try again.' as const;
  }
  if (error instanceof Error && error.message === 'auth_not_configured') {
    return 'Sign-in is unavailable right now. You can still explore the demo.' as const;
  }
  return 'We could not complete that request. Check your connection and try again.' as const;
}
