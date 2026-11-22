import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useVenueCatalog, type AccountCatalogValue } from '@/features/catalog/catalog-provider';
import { createSessionSubmissionId } from './contribution-state';
import { accountContributionRepository } from './account-contribution-repository';
import { createAccountContributionStore } from './account-contribution-store';

type Store=ReturnType<typeof createAccountContributionStore>;
type Value=ReturnType<Store['getSnapshot']>&Pick<Store,'submit'|'retry'|'refresh'>;
const Context=createContext<Value|null>(null);
export function AccountContributionsProvider({children}:PropsWithChildren){
  const catalog=useVenueCatalog();
  if(catalog.mode==='demo' || !supabase)return <Context.Provider value={null}>{children}</Context.Provider>;
  return <AccountContributions key={catalog.userId} catalog={catalog}>{children}</AccountContributions>;
}
function AccountContributions({children,catalog}:PropsWithChildren<{catalog:AccountCatalogValue}>){
  const [store]=useState(()=>createAccountContributionStore(catalog.userId,accountContributionRepository(supabase!),createSessionSubmissionId,catalog.invalidate));
  const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
  useEffect(()=>store.start(),[store]);
  useEffect(()=>store.setCatalog(catalog),[store,catalog]);
  useEffect(()=>{
    const listener=AppState.addEventListener('change',state=>{if(state==='active')void store.refresh();});
    const timer=setInterval(()=>{if(AppState.currentState==='active')void store.refresh();},60_000);
    return()=>{listener.remove();clearInterval(timer);};
  },[store]);
  const value=useMemo(()=>({...snapshot,submit:store.submit,retry:store.retry,refresh:store.refresh}),[snapshot,store]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccountContributions(){
  const value=useContext(Context);if(!value)throw new Error('Account contributions require a signed-in catalog');return value;
}
