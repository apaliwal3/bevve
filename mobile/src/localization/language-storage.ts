import type { LanguageStorage } from './language-store';

// Web/SSR fallback deliberately uses memory, never browser localStorage.
// Metro resolves language-storage.native.ts on iOS/Android.
let value: string | null = null;
export const languageStorage: LanguageStorage = {
  persistent: false,
  getItem: async () => value,
  setItem: async (_key, next) => { value = next; },
};
