import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useVenueCatalog, type AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { createSessionSubmissionId } from './contribution-state';
import { accountSafetyRepository } from './account-safety-repository';
import { createAccountSafetyStore } from './account-safety-store';

type Store = ReturnType<typeof createAccountSafetyStore>;
type Value = ReturnType<Store['getSnapshot']> & Pick<Store, 'submit' | 'retry' | 'refresh' | 'refreshQueue' | 'refreshPublic' | 'moderate' | 'updateDraft' | 'updateReviewDraft'>;
const Context = createContext<Value | null>(null);
export function AccountSafetyProvider({ children }: PropsWithChildren) {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'demo' || !supabase) return <Context.Provider value={null}>{children}</Context.Provider>;
  return <AccountSafety key={catalog.userId} catalog={catalog}>{children}</AccountSafety>;
}
function AccountSafety({ children, catalog }: PropsWithChildren<{ catalog: AccountCatalogValue }>) {
  const [store] = useState(() => createAccountSafetyStore(catalog.userId, accountSafetyRepository(supabase!), createSessionSubmissionId));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(), [store]);
  useEffect(() => store.setCatalog(catalog), [store, catalog]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') store.refreshAll(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') store.refreshAll(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [store]);
  const value = useMemo(() => ({ ...snapshot, submit: store.submit, retry: store.retry, refresh: store.refresh,
    refreshQueue: store.refreshQueue, refreshPublic: store.refreshPublic, moderate: store.moderate,
    updateDraft: store.updateDraft, updateReviewDraft: store.updateReviewDraft }), [snapshot, store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccountSafety() {
  const value = useContext(Context); if (!value) throw new Error('Account safety requires a signed-in catalog'); return value;
}
