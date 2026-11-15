import { en } from './en.ts';
import { it } from './it.ts';

export type Language = 'en' | 'it';
export type Message = string | { readonly one: string; readonly other: string };
export type TranslationKey = keyof typeof en;
type Slots<S extends string> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Slots<Rest> : never;
type Values<K extends TranslationKey> = { [P in Slots<K>]: P extends 'count' ? number : string | number };
type Arguments<K extends TranslationKey> = [Slots<K>] extends [never] ? [] : [values: Values<K>];
export type Translate = <K extends TranslationKey>(key: K, ...args: Arguments<K>) => string;
export type PlainTranslationKey = { [K in TranslationKey]: Slots<K> extends never ? K : never }[TranslationKey];

export const languages = [{ code: 'en', label: 'English' }, { code: 'it', label: 'Italiano' }] as const;
export const localeFor: Record<Language, string> = { en: 'en-GB', it: 'it-IT' };
export function isLanguage(value: unknown): value is Language { return value === 'en' || value === 'it'; }

export function createTranslator(language: Language): Translate {
  const dictionary: Record<TranslationKey, Message> = language === 'it' ? it : en;
  // Some Expo Go/Hermes runtimes omit PluralRules. EN and IT both use
  // "one" for an absolute count of 1, and "other" for our remaining count messages.
  const plurals = typeof Intl.PluralRules === 'function' ? new Intl.PluralRules(localeFor[language]) : null;
  const numbers = new Intl.NumberFormat(localeFor[language]);
  return function translate<K extends TranslationKey>(key: K, ...args: Arguments<K>): string {
    const values = args[0] as Record<string, string | number> | undefined;
    const message = dictionary[key];
    const count = Number(values?.count ?? 0);
    const singular = plurals ? plurals.select(count) === 'one' : Math.abs(count) === 1;
    const text = typeof message === 'string' ? message : singular ? message.one : message.other;
    return text.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = values?.[name];
      if (value === undefined) throw new Error('Missing translation parameter: ' + name);
      return name === 'count' && typeof value === 'number' ? numbers.format(value) : String(value);
    });
  };
}

// Only app-owned fixture descriptions use this lookup. Never pass venue names,
// neighborhoods, drink names or user-entered text through it.
const descriptions: Record<string, PlainTranslationKey> = {
  'Loud & social': 'Loud & social', 'Chill & chatty': 'Chill & chatty',
  'Indie & electric': 'Indie & electric', 'Intimate cocktails': 'Intimate cocktails',
  '8 min walk': '8 min walk', '12 min walk': '12 min walk', '1.4 km': '1.4 km',
  Buzzing: 'Buzzing', Easygoing: 'Easygoing', Lively: 'Lively',
  quiet: 'Quiet crowd', moderate: 'Moderate crowd', busy: 'Busy crowd',
  Quiet: 'Quiet crowd', Moderate: 'Moderate crowd', Busy: 'Busy crowd',
};
export function describeFixture(value: string, t: Translate): string {
  const key = Object.prototype.hasOwnProperty.call(descriptions, value) ? descriptions[value] : undefined;
  return key ? t(key) : value;
}
