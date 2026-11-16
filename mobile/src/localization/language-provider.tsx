import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';

import { createLocaleFormatters } from './formatting';
import { createLanguageStore } from './language-store';
import { languageStorage } from './language-storage';
import { createTranslator, describeFixture } from './translation';

function useLanguageValue(store: ReturnType<typeof createLanguageStore>) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return useMemo(() => {
    const t = createTranslator(snapshot.language);
    return {
      ...snapshot, t, format: createLocaleFormatters(snapshot.language),
      describe: (value: string) => describeFixture(value, t),
      setLanguage: store.select, persistent: store.persistent,
    };
  }, [snapshot, store]);
}
const LanguageContext = createContext<ReturnType<typeof useLanguageValue> | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => createLanguageStore(languageStorage));
  const value = useLanguageValue(store);
  useEffect(() => { void store.initialize(); }, [store]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useTranslation must be used inside LanguageProvider.');
  return context;
}
