import type { Session, SupabaseClient } from '@supabase/supabase-js';

export type AuthSnapshot = {
  session: Session | null;
  ready: boolean;
  error: 'Your session could not be restored. Please sign in again.' | null;
};

// Keep sessions out of form drafts, navigation params, and application logs.
export function createAuthStore(client: SupabaseClient | null) {
  let snapshot: AuthSnapshot = { session: null, ready: !client, error: null };
  const listeners = new Set<() => void>();
  let revision = 0;
  function publish(next: AuthSnapshot) {
    revision++;
    snapshot = next;
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
      const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
        if (active) publish({ session, ready: true, error: null });
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
      const { data, error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.session) throw new Error('auth_session_missing');
      publish({ session: data.session, ready: true, error: null });
    },
    async signUp(email: string, password: string, username: string) {
      const { data, error } = await requireClient().auth.signUp({ email: email.trim(), password,
        options: { data: { username: username.trim() } } });
      if (error) throw error;
      if (data.session) publish({ session: data.session, ready: true, error: null });
      return data.session ? 'signed-in' as const : 'confirm-email' as const;
    },
    async signOut() {
      const { error } = await requireClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      publish({ session: null, ready: true, error: null });
    },
  };
}

const serverSnapshot: AuthSnapshot = { session: null, ready: false, error: null };

export function authErrorMessage(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'invalid_credentials') return 'The email or password is incorrect.' as const;
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in.' as const;
  if (code === 'weak_password') return 'Choose a stronger password and try again.' as const;
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'Too many attempts. Please wait a little and try again.' as const;
  }
  if (error instanceof Error && error.message === 'auth_not_configured') {
    return 'Sign-in is unavailable right now. You can still explore the demo.' as const;
  }
  return 'We could not complete that request. Check your connection and try again.' as const;
}
