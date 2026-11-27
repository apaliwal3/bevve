import { createContext, useContext, type PropsWithChildren } from 'react';

import { createLocaleFormatters } from './formatting';
import { createTranslator, describeFixture } from './translation';

const t = createTranslator('en');
// The interface is English-only. Do not read the former device preference:
// an older installation may still have "it" stored in AsyncStorage.
const english = {
  language: 'en' as const,
  ready: true,
  t,
  format: createLocaleFormatters('en'),
  describe: (value: string) => describeFixture(value, t),
};
const LanguageContext = createContext(english);

export function LanguageProvider({ children }: PropsWithChildren) {
  return <LanguageContext.Provider value={english}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  return useContext(LanguageContext);
}
