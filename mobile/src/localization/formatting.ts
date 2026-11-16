import { createTranslator, localeFor, type Language } from './translation.ts';

type TimeInput = string | number | Date;
type RelativeUnit = 'second' | 'minute' | 'hour' | 'day';
const relativeMessages = {
  second: { past: '{count} seconds ago', future: 'in {count} seconds' },
  minute: { past: '{count} minutes ago', future: 'in {count} minutes' },
  hour: { past: '{count} hours ago', future: 'in {count} hours' },
  day: { past: '{count} days ago', future: 'in {count} days' },
} as const;

function relativeTime(language: Language, amount: number, unit: RelativeUnit): string {
  const rounded = Math.round(amount);
  if (typeof Intl.RelativeTimeFormat === 'function') {
    return new Intl.RelativeTimeFormat(localeFor[language], { numeric: 'auto' }).format(rounded, unit);
  }
  // Hermes may omit RelativeTimeFormat as well as PluralRules.
  const t = createTranslator(language);
  if (rounded === 0) return t('Just now');
  if (unit === 'day' && rounded === -1) return t('Yesterday');
  if (unit === 'day' && rounded === 1) return t('Tomorrow');
  return t(relativeMessages[unit][rounded < 0 ? 'past' : 'future'], { count: Math.abs(rounded) });
}

export function createLocaleFormatters(language: Language) {
  const locale = localeFor[language];
  const date = (value: TimeInput) => value instanceof Date ? value : new Date(value);
  return {
    currency: (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100),
    number: (value: number) => new Intl.NumberFormat(locale).format(value),
    decimal: (value: number, digits = 1) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value),
    dateTime: (value: TimeInput, timeZone?: string) => {
      const time = date(value);
      return Number.isFinite(time.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(time) : '—';
    },
    date: (value: TimeInput, timeZone?: string) => {
      const time = date(value);
      return Number.isFinite(time.getTime()) ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(time) : '—';
    },
    relativeTime: (value: TimeInput, now = Date.now()) => {
      const seconds = (date(value).getTime() - now) / 1000;
      if (!Number.isFinite(seconds)) return '—';
      const [amount, unit]: [number, RelativeUnit] = Math.abs(seconds) < 60 ? [seconds, 'second']
        : Math.abs(seconds) < 3600 ? [seconds / 60, 'minute']
          : Math.abs(seconds) < 86400 ? [seconds / 3600, 'hour'] : [seconds / 86400, 'day'];
      return relativeTime(language, amount, unit);
    },
  };
}
