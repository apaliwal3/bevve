import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { SESSION_USER_ID } from '@/features/contributions/contribution-state';
import { supabase } from '@/lib/supabase';
import { savedBarsRepository } from './saved-bars-repository';
import { createSavedBarsStore } from './saved-bars-store';

type Store = ReturnType<typeof createSavedBarsStore>;
type Value = ReturnType<Store['getSnapshot']> & Pick<Store, 'refresh' | 'setSaved'>;
const Context = createContext<Value | null>(null);
export function SavedBarsProvider({ children }: PropsWithChildren) {
  const catalog = useVenueCatalog();
  const owner = catalog.mode === 'account' ? catalog.userId : SESSION_USER_ID;
  return <SavedBars key={catalog.mode + ':' + owner} owner={owner} account={catalog.mode === 'account'}>{children}</SavedBars>;
}
function SavedBars({ owner, account, children }: PropsWithChildren<{ owner: string; account: boolean }>) {
  const [store] = useState(() => createSavedBarsStore(owner, account ? savedBarsRepository(supabase!) : null));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(), [store]);
  useEffect(() => {
    if (!account) return;
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void store.refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void store.refresh(); }, 60_000);
    return () => { listener.remove(); clearInterval(timer); };
  }, [account, store]);
  const value = useMemo(() => ({ ...snapshot, refresh: store.refresh, setSaved: store.setSaved }), [snapshot, store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSavedBars() {
  const value = useContext(Context);
  if (!value) throw new Error('Saved bars require SavedBarsProvider');
  return value;
}
