import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { useVenueCatalog } from '@/features/catalog/catalog-provider';
import { locationRepository } from './location-repository';
import { createLocationStore } from './location-store';

type Store = ReturnType<typeof createLocationStore>;
type Value = ReturnType<Store['getSnapshot']> & Pick<Store, 'enable' | 'refresh' | 'openSettings'>;
const Context = createContext<Value | null>(null);
export function AccountLocationProvider({ children }: PropsWithChildren) {
  const catalog = useVenueCatalog();
  if (catalog.mode === 'demo') return <Context.Provider value={null}>{children}</Context.Provider>;
  return <AccountLocation key={catalog.userId}>{children}</AccountLocation>;
}
function AccountLocation({ children }: PropsWithChildren) {
  const [store] = useState(() => createLocationStore(locationRepository));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  useEffect(() => store.start(AppState.currentState === 'active'), [store]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state === 'background') store.suspend(); else if (state === 'active') store.resume();
    });
    return () => listener.remove();
  }, [store]);
  const value = useMemo(() => ({ ...snapshot, enable: store.enable, refresh: store.refresh, openSettings: store.openSettings }), [snapshot, store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccountLocation() {
  const value = useContext(Context); if (!value) throw new Error('Device location requires an account catalog'); return value;
}
