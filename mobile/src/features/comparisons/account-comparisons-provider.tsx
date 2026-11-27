import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useVenueCatalog, type AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { catalogVenue } from '@/features/catalog/catalog-adapters';
import { createSessionSubmissionId } from '@/features/contributions/contribution-state';
import { selectPersonalRankings } from '@/features/rankings/personal-rankings';
import { createAccountComparisonStore } from './account-comparison-store';
import { accountComparisonRepository } from './account-comparison-repository';

type Store = ReturnType<typeof createAccountComparisonStore>;
type Value = Omit<ReturnType<Store['getSnapshot']>, 'history'> & {
  rankings: ReturnType<typeof selectPersonalRankings>;
  begin: Store['begin']; choose: Store['choose']; skip: Store['skip']; refresh: Store['refresh'];
};
const Context = createContext<Value | null>(null);
export function AccountComparisonsProvider({ children }: PropsWithChildren) {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'demo' || !supabase) return <Context.Provider value={null}>{children}</Context.Provider>;
  return <AccountComparisons key={catalog.userId} catalog={catalog}>{children}</AccountComparisons>;
}
function AccountComparisons({ children, catalog }: PropsWithChildren<{ catalog: AccountCatalogValue }>) {
  const [store] = useState(() => createAccountComparisonStore(catalog.userId, accountComparisonRepository(supabase!), createSessionSubmissionId));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(), [store]);
  useEffect(() => { store.setCatalog(catalog); }, [store, catalog]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void store.refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void store.refresh(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [store]);
  const value = useMemo<Value>(() => ({ status: snapshot.status, refreshing: snapshot.refreshing, error: snapshot.error,
    batches: snapshot.batches,
    rankings: selectPersonalRankings({ history: snapshot.history, rankings: store.rankings() }, catalog.venues.map(catalogVenue)),
    begin: store.begin, choose: store.choose, skip: store.skip, refresh: store.refresh,
  }), [snapshot, store, catalog.venues]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccountComparisons() {
  const value = useContext(Context);
  if (!value) throw new Error('Account comparisons require a signed-in catalog');
  return value;
}
