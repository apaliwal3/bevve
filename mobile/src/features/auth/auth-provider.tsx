import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { createAuthStore } from './auth-store';

type AuthValue = ReturnType<ReturnType<typeof createAuthStore>['getSnapshot']> & {
  configured: boolean;
  signIn: ReturnType<typeof createAuthStore>['signIn'];
  signUp: ReturnType<typeof createAuthStore>['signUp'];
  signOut: ReturnType<typeof createAuthStore>['signOut'];
};
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createAuthStore(supabase));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(), [store]);
  useEffect(() => {
    if (!supabase || Platform.OS === 'web') return;
    const client = supabase;
    const update = (state: string | null | undefined) => {
      if (state === 'active') client.auth.startAutoRefresh();
      else client.auth.stopAutoRefresh();
    };
    update(AppState.currentState);
    const subscription = AppState.addEventListener('change', update);
    return () => { subscription.remove(); client.auth.stopAutoRefresh(); };
  }, []);
  const value = useMemo(() => ({ ...snapshot, configured: store.configured,
    signIn: store.signIn, signUp: store.signUp, signOut: store.signOut }), [snapshot, store]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
