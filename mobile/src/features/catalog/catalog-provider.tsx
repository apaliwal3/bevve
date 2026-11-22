import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/features/auth/auth-provider';
import { supabase } from '@/lib/supabase';
import { catalogRepository } from './catalog-repository';
import { createCatalogStore } from './catalog-store';

type CatalogValue = { mode: 'demo' } | ({ mode: 'account'; userId: string } & ReturnType<ReturnType<typeof createCatalogStore>['getSnapshot']> & {
  refresh: ReturnType<typeof createCatalogStore>['refresh']; save: ReturnType<typeof createCatalogStore>['save'];
  invalidate: ReturnType<typeof createCatalogStore>['invalidate'];
});
const CatalogContext = createContext<CatalogValue | null>(null);
const demo = { mode: 'demo' as const };

export function VenueCatalogProvider({ children }: PropsWithChildren) {
  const { session } = useAuth();
  if (!session || !supabase) return <CatalogContext.Provider value={demo}>{children}</CatalogContext.Provider>;
  return <AccountCatalog key={session.user.id} userId={session.user.id}>{children}</AccountCatalog>;
}

function AccountCatalog({ children, userId }: PropsWithChildren<{ userId: string }>) {
  const [store] = useState(() => createCatalogStore(userId, catalogRepository(supabase!)));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(), [store]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void store.refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void store.refresh(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [store]);
  const value = useMemo<CatalogValue>(() => ({ mode: 'account', userId, ...snapshot, refresh: store.refresh, save: store.save, invalidate: store.invalidate }), [snapshot, store, userId]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useVenueCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('useVenueCatalog must be used inside VenueCatalogProvider');
  return value;
}
export type AccountCatalogValue = Extract<CatalogValue, { mode: 'account' }>;
