import { mockDrinkCatalog } from '../fixtures/contribution-catalog.ts';
import type { CrowdLevel } from '../features/contributions/contribution-state.ts';
import type { VenueDrinkPrice } from '../features/contributions/venue-extras-state.ts';
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS } from '../features/contributions/venue-extras-state.ts';
import { describeFixture, type PlainTranslationKey, type Translate } from './translation.ts';

export const crowdLevelKeys: Record<CrowdLevel, PlainTranslationKey> = {
  1: 'Very quiet crowd', 2: 'Quiet crowd', 3: 'Moderate crowd', 4: 'Busy crowd', 5: 'Packed crowd',
};
const venueLanguageKeys: Record<string, PlainTranslationKey> = {
  en: 'English', it: 'Italian', es: 'Spanish', fr: 'French',
  de: 'German', pt: 'Portuguese', ar: 'Arabic', ja: 'Japanese',
};
const categoryKeys: Record<string, PlainTranslationKey> = {
  Beer: 'Beer', Cocktail: 'Cocktail', 'Long drink': 'Long drink',
};

export function venueLanguageLabel(code: string, t: Translate, fallback = code): string {
  return Object.prototype.hasOwnProperty.call(venueLanguageKeys, code) ? t(venueLanguageKeys[code]) : fallback;
}

export function drinkCategoryLabel(category: string, t: Translate): string {
  return Object.prototype.hasOwnProperty.call(categoryKeys, category) ? t(categoryKeys[category]) : category;
}

export function venueServingLabel(drink: Pick<VenueDrinkPrice, 'id' | 'serving' | 'source'>, t: Translate): string {
  const catalog = mockDrinkCatalog.find((item) => item.id === drink.id);
  return drink.source === 'session' && catalog
    ? t('{category} · {volume} ml', { category: drinkCategoryLabel(catalog.category, t), volume: catalog.serving_ml })
    : describeFixture(drink.serving, t);
}

const validationKeys: Record<string, PlainTranslationKey> = {
  'Enter a EUR price with up to two decimals, e.g. 6.50 or 6,50.': 'Enter a EUR price with up to two decimals, e.g. 6.50 or 6,50.',
  'Choose an incident category.': 'Choose an incident category.',
  'Enter a description (1–4,000 characters).': 'Enter a description (1–4,000 characters).',
  'Use YYYY-MM-DD for the optional date.': 'Use YYYY-MM-DD for the optional date.',
  'Enter a real date that is today or earlier.': 'Enter a real date that is today or earlier.',
};

// Translate validator output at the UI boundary; validation and saved contracts stay unchanged.
export function contributionError(message: string, t: Translate, currency: (cents: number) => string): string {
  if (message === 'Use a price from €0.50 to €100 for this demo.') {
    return t('Use a price from {min} to {max} for this demo.', { min: currency(MIN_PRICE_CENTS), max: currency(MAX_PRICE_CENTS) });
  }
  return Object.prototype.hasOwnProperty.call(validationKeys, message) ? t(validationKeys[message]) : t('Check the form and try again.');
}
