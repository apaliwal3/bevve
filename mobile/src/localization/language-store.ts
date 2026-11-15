import { isLanguage, type Language } from './translation.ts';

export const LANGUAGE_STORAGE_KEY = 'bevve.interface-language.v1';
export type LanguageStorage = {
  persistent: boolean;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};
type Snapshot = { language: Language; ready: boolean; saving: boolean; error: boolean };

// The only persisted value is en/it. This store cannot own or reset app-session data.
export function createLanguageStore(storage: LanguageStorage) {
  let snapshot: Snapshot = { language: 'en', ready: false, saving: false, error: false };
  const serverSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let initialization: Promise<void> | undefined;
  let writes: Promise<void> = Promise.resolve();
  let revision = 0;
  const update = (next: Snapshot) => { snapshot = next; listeners.forEach((listener) => listener()); };
  return {
    persistent: storage.persistent,
    getSnapshot: () => snapshot,
    getServerSnapshot: () => serverSnapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    initialize: () => {
      initialization ??= Promise.resolve().then(() => storage.getItem(LANGUAGE_STORAGE_KEY)).then((saved) => {
        if (revision === 0) update({ language: isLanguage(saved) ? saved : 'en', ready: true, saving: false, error: false });
      }).catch(() => {
        if (revision === 0) update({ language: 'en', ready: true, saving: false, error: true });
      });
      return initialization;
    },
    select: (language: Language): Promise<void> => {
      if (!isLanguage(language)) return Promise.resolve();
      const current = ++revision;
      update({ language, ready: true, saving: true, error: false });
      writes = writes.then(() => storage.setItem(LANGUAGE_STORAGE_KEY, language)).then(() => {
        if (current === revision) update({ ...snapshot, saving: false, error: false });
      }).catch(() => {
        if (current === revision) update({ ...snapshot, saving: false, error: true });
      });
      return writes;
    },
  };
}
