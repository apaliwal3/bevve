import assert from 'node:assert/strict';
import { test } from 'node:test';

import { en } from '../src/localization/en.ts';
import { it } from '../src/localization/it.ts';
import { createTranslator, describeFixture, isLanguage, languages } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { validateAuthForm } from '../src/features/auth/auth-validation.ts';

const slots = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('English and Italian dictionaries have complete keys, matching placeholders and plural variants', () => {
  assert.deepEqual(Object.keys(it).sort(), Object.keys(en).sort());
  for (const [key, english] of Object.entries(en)) {
    const italian = it[key];
    assert.equal(typeof italian, typeof english, key);
    const variants = typeof english === 'string' ? [english] : Object.values(english);
    const translated = typeof italian === 'string' ? [italian] : Object.values(italian);
    if (typeof english !== 'string') assert.deepEqual(Object.keys(italian).sort(), ['one', 'other']);
    variants.forEach((variant, index) => {
      assert.deepEqual(slots(variant), slots(key), key);
      assert.deepEqual(slots(translated[index]), slots(key), key);
      assert.ok(translated[index].trim().length > 0, key);
    });
  }
});

test('every dictionary message renders in both languages without unresolved placeholders', () => {
  for (const { code } of languages) {
    const t = createTranslator(code);
    for (const key of Object.keys(en)) {
      const values = Object.fromEntries(slots(key).map((slot) => [slot, slot === 'count' ? 2 : 'sample']));
      const message = t(key, values);
      assert.ok(message.length > 0, key);
      assert.ok(!/\{\w+\}/.test(message), key);
    }
  }
});

test('interface language boundaries accept only normalized en and it', () => {
  assert.deepEqual(languages.map((item) => item.code), ['en', 'it']);
  assert.equal(isLanguage('en'), true);
  assert.equal(isLanguage('it'), true);
  for (const invalid of [null, undefined, '', 'IT', 'it-IT', 'fr', {}, 1]) assert.equal(isLanguage(invalid), false);
});

test('Expo Go runtimes without Intl.PluralRules can start and render EN/IT plural messages', () => {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules');
  try {
    Object.defineProperty(Intl, 'PluralRules', { configurable: true, value: undefined });
    for (const language of ['en', 'it']) {
      const t = createTranslator(language);
      assert.equal(t('Explore'), language === 'it' ? 'Esplora' : 'Explore');
      for (const count of [0, 1, -1, 2, 1.5, 1000000]) {
        const plural = Math.abs(count) === 1 ? 'one' : 'other';
        const dictionary = language === 'it' ? it : en;
        const expected = dictionary['{count} comparisons'][plural].replace('{count}', new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-GB').format(count));
        assert.equal(t('{count} comparisons', { count }), expected);
      }
      assert.equal(t('Back to {name}', { name: 'Luna Rossa' }), language === 'it' ? 'Torna a Luna Rossa' : 'Back to Luna Rossa');
    }
  } finally {
    if (descriptor) Object.defineProperty(Intl, 'PluralRules', descriptor);
    else delete Intl.PluralRules;
  }
});

test('core labels and zero, singular and plural empty-state counts translate naturally', () => {
  const t = createTranslator('it');
  assert.equal(t('Explore'), 'Esplora');
  assert.equal(t('Sign In'), 'Accedi');
  assert.equal(t('No activity yet'), 'Nessuna attività');
  assert.equal(t('{count} comparisons', { count: 0 }), '0 confronti');
  assert.equal(t('{count} comparisons', { count: 1 }), '1 confronto');
  assert.equal(t('{count} comparisons', { count: 2 }), '2 confronti');
  assert.equal(createTranslator('en')('{count} bars ranked', { count: 1 }), '1 bar ranked');
});

test('interpolation preserves venue names, neighborhoods and user text verbatim', () => {
  const t = createTranslator('it');
  const name = 'Luna Rossa {name}';
  const area = 'Porta Venezia';
  assert.equal(t('Back to {name}', { name }), 'Torna a ' + name);
  const message = t('{name}, {area}, {rating}. View venue', { name, area, rating: '4,5/5' });
  assert.ok(message.includes(name) && message.includes(area) && message.includes('4,5/5'));
  assert.equal(describeFixture('Aperol Spritz', t), 'Aperol Spritz');
  assert.equal(describeFixture('Porta Venezia', t), 'Porta Venezia');
  assert.equal(describeFixture('toString', t), 'toString');
  assert.equal(describeFixture('Loud & social', t), 'Vivace e socievole');
  assert.equal(describeFixture('Quiet', t), 'Bassa');
});

test('auth validation remains unchanged and its error values can be translated at render time', () => {
  const result = validateAuthForm('signup', { username: '', email: 'invalid', password: '123' });
  const t = createTranslator('it');
  assert.equal(t(result.email), 'Inserisci un indirizzo email valido.');
  assert.equal(t(result.password), 'La password deve contenere almeno 6 caratteri.');
  assert.equal(t(result.username), 'Il nome utente deve contenere almeno 2 caratteri.');
});

test('EUR formatting changes display separators without altering integer cents', () => {
  const observation = Object.freeze({ price_cents: 650, observed_at: '2026-11-15T20:30:00Z' });
  const english = createLocaleFormatters('en');
  const italian = createLocaleFormatters('it');
  assert.equal(english.currency(observation.price_cents), '€6.50');
  assert.equal(italian.currency(observation.price_cents).replace(/\s/g, ' '), '6,50 €');
  assert.equal(italian.currency(0).replace(/\s/g, ' '), '0,00 €');
  assert.equal(italian.decimal(4.75), '4,8');
  assert.equal(english.decimal(4.75), '4.8');
  assert.equal(italian.number(12345), '12.345');
  assert.equal(observation.price_cents, 650);
  assert.equal(observation.observed_at, '2026-11-15T20:30:00Z');
});

test('date, timestamp and relative-time helpers respect the chosen locale and handle invalid data', () => {
  const english = createLocaleFormatters('en');
  const italian = createLocaleFormatters('it');
  const value = '2026-11-15T20:30:00Z';
  assert.equal(english.date(value, 'UTC'), '15 Nov 2026');
  assert.equal(italian.date(value, 'UTC'), '15 nov 2026');
  assert.equal(italian.dateTime(value, 'UTC'), new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value)));
  const now = Date.parse(value);
  assert.equal(english.relativeTime(now - 86400000, now), 'yesterday');
  assert.equal(italian.relativeTime(now - 86400000, now), 'ieri');
  assert.equal(italian.relativeTime(now - 120000, now), '2 minuti fa');
  assert.equal(italian.relativeTime(now + 3600000, now), 'tra 1 ora');
  for (const format of [english, italian]) {
    assert.equal(format.date('invalid'), '—');
    assert.equal(format.dateTime('invalid'), '—');
    assert.equal(format.relativeTime('invalid'), '—');
  }
});

test('relative time remains usable when Hermes omits both optional Intl constructors', () => {
  const descriptors = ['PluralRules', 'RelativeTimeFormat'].map((name) => [name, Object.getOwnPropertyDescriptor(Intl, name)]);
  try {
    for (const [name] of descriptors) Object.defineProperty(Intl, name, { configurable: true, value: undefined });
    const now = Date.parse('2026-11-15T20:30:00Z');
    const english = createLocaleFormatters('en');
    const italian = createLocaleFormatters('it');
    const cases = [
      [0, 'Just now', 'Adesso'],
      [-1000, '1 second ago', '1 secondo fa'],
      [2000, 'in 2 seconds', 'tra 2 secondi'],
      [-60000, '1 minute ago', '1 minuto fa'],
      [-120000, '2 minutes ago', '2 minuti fa'],
      [3600000, 'in 1 hour', 'tra 1 ora'],
      [-7200000, '2 hours ago', '2 ore fa'],
      [-86400000, 'Yesterday', 'Ieri'],
      [86400000, 'Tomorrow', 'Domani'],
      [-259200000, '3 days ago', '3 giorni fa'],
      [259200000, 'in 3 days', 'tra 3 giorni'],
    ];
    for (const [offset, enText, itText] of cases) {
      assert.equal(english.relativeTime(now + offset, now), enText);
      assert.equal(italian.relativeTime(now + offset, now), itText);
    }
    assert.equal(italian.currency(650).replace(/\s/g, ' '), '6,50 €');
    assert.equal(italian.dateTime('invalid'), '—');
    assert.equal(italian.relativeTime('invalid', now), '—');
  } finally {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(Intl, name, descriptor);
      else delete Intl[name];
    }
  }
});
