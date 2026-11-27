import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useVenueCatalog, type AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { createSessionSubmissionId } from './contribution-state';
import { accountLanguageRepository } from './account-language-repository';
import { createAccountLanguageStore } from './account-language-store';

type Store = ReturnType<typeof createAccountLanguageStore>;
type Value = ReturnType<Store['getSnapshot']> & Pick<Store, 'submit' | 'retry' | 'refresh' | 'refreshQueue' | 'moderate'>;
const Context = createContext<Value | null>(null);
export function AccountLanguagesProvider({ children }: PropsWithChildren) {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'demo' || !supabase) return <Context.Provider value={null}>{children}</Context.Provider>;
  return <AccountLanguages key={catalog.userId} catalog={catalog}>{children}</AccountLanguages>;
}
function AccountLanguages({ children, catalog }: PropsWithChildren<{ catalog: AccountCatalogValue }>) {
  const [store] = useState(() => createAccountLanguageStore(catalog.userId, accountLanguageRepository(supabase!), createSessionSubmissionId, catalog.invalidate));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(), [store]);
  useEffect(() => store.setCatalog(catalog), [store, catalog]);
  useEffect(() => {
    const refresh = () => { void store.refresh(); void store.refreshQueue(); };
    const listener = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [store]);
  const value = useMemo(() => ({ ...snapshot, submit: store.submit, retry: store.retry, refresh: store.refresh,
    refreshQueue: store.refreshQueue, moderate: store.moderate }), [snapshot, store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccountLanguages() {
  const value = useContext(Context);
  if (!value) throw new Error('Account language suggestions require a signed-in catalog');
  return value;
}
