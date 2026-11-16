import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTranslator, describeFixture } from '../src/localization/translation.ts';
import { createLocaleFormatters } from '../src/localization/formatting.ts';
import { contributionError, crowdLevelKeys, drinkCategoryLabel, venueLanguageLabel, venueServingLabel } from '../src/localization/venue-copy.ts';
import { mockDrinkCatalog, languageCatalog } from '../src/fixtures/contribution-catalog.ts';
import { mockVenueDetails, mockVenues } from '../src/fixtures/venues.ts';
import { parseEuroPrice, incidentCategories, initialVenueExtrasState, venueExtrasReducer } from '../src/features/contributions/venue-extras-state.ts';
import { incidentSubmission, emptyIncidentDraft, priceDraftReducer, incidentDraftReducer, languageDraftReducer } from '../src/features/contributions/extra-form-drafts.ts';
import { createLanguageStore } from '../src/localization/language-store.ts';
import { rankingBadgeSize } from '../src/features/rankings/ranking-summary-layout.ts';
import { SESSION_USER_ID } from '../src/features/contributions/contribution-state.ts';

test('crowd levels, bathroom labels, actions and incident categories have natural EN/IT display values', () => {
  const english = createTranslator('en'), italian = createTranslator('it');
  assert.deepEqual([1, 2, 3, 4, 5].map((level) => english(crowdLevelKeys[level])), ['Very Quiet', 'Quiet', 'Moderate', 'Busy', 'Packed']);
  assert.deepEqual([1, 2, 3, 4, 5].map((level) => italian(crowdLevelKeys[level])), ['Molto bassa', 'Bassa', 'Moderata', 'Alta', 'Al completo']);
  assert.deepEqual(['Cleanliness', 'Accessibility', 'Waiting time'].map((key) => italian(key)), ['Pulizia', 'Accessibilità', 'Attesa']);
  assert.deepEqual(['Report crowd', 'Rate bathrooms', 'Update drink prices', 'Spoken languages', 'Safety information'].map((key) => italian(key)), ['Segnala l’affluenza', 'Valuta i bagni', 'Aggiorna i prezzi dei drink', 'Lingue parlate', 'Informazioni sulla sicurezza']);
  assert.deepEqual(incidentCategories.map((category) => italian(category)), ['Furto', 'Molestie', 'Violenza', 'Altro']);
  assert.deepEqual(incidentCategories, ['Theft', 'Harassment', 'Violence', 'Other']);
});

test('spoken-language labels use stable venue codes without depending on Intl.DisplayNames', () => {
  const t = createTranslator('it');
  assert.deepEqual(languageCatalog.map((entry) => venueLanguageLabel(entry.code, t)), ['Inglese', 'Italiano', 'Spagnolo', 'Francese', 'Tedesco', 'Portoghese', 'Arabo', 'Giapponese']);
  assert.equal(venueLanguageLabel('unknown', t, 'Original supplied name'), 'Original supplied name');
  assert.equal(venueLanguageLabel('toString', t), 'toString');
  assert.equal(drinkCategoryLabel('Beer', t), 'Birra');
  assert.equal(drinkCategoryLabel('Aperol Spritz', t), 'Aperol Spritz');
});

test('demo and session serving descriptions translate without modifying catalog identity or serving sizes', () => {
  const t = createTranslator('it');
  const before = JSON.stringify({ mockDrinkCatalog, mockVenueDetails, mockVenues });
  const demo = mockVenueDetails[mockVenues[0].id].drinks[0];
  assert.equal(venueServingLabel({ ...demo, source: 'demo' }, t), 'Alla spina · 0,4 L');
  assert.equal(venueServingLabel({ ...demo, source: 'session' }, t), 'Birra · 400 ml');
  assert.equal(describeFixture('Sample hours · Until 02:00', t), 'Orario di esempio · Fino alle 02:00');
  for (const drink of mockDrinkCatalog) {
    const label = t('{name}, {category}, {volume} millilitres', { name: drink.name, category: drinkCategoryLabel(drink.category, t), volume: drink.serving_ml });
    assert.ok(label.includes(drink.name));
  }
  assert.equal(JSON.stringify({ mockDrinkCatalog, mockVenueDetails, mockVenues }), before);
});

test('all price and incident validation paths translate at the UI boundary, with localized price limits', () => {
  const t = createTranslator('it'), format = createLocaleFormatters('it');
  const priceError = parseEuroPrice('invalid');
  assert.equal(priceError.ok, false);
  assert.equal(contributionError(priceError.error, t, format.currency), 'Inserisci un prezzo in EUR con un massimo di due decimali, ad esempio 6,50 o 6.50.');
  const rangeError = parseEuroPrice('0.49');
  assert.equal(rangeError.ok, false);
  const limits = contributionError(rangeError.error, t, format.currency);
  assert.ok(limits.includes(format.currency(50)) && limits.includes(format.currency(10000)));
  const drafts = [
    [emptyIncidentDraft, 'Scegli una categoria per l’incidente.'],
    [{ ...emptyIncidentDraft, category: 'Other' }, 'Inserisci una descrizione (da 1 a 4.000 caratteri).'],
    [{ category: 'Theft', description: 'User content', date: '16/11/2026' }, 'Usa il formato AAAA-MM-GG per la data facoltativa.'],
    [{ category: 'Theft', description: 'User content', date: '2026-02-30' }, 'Inserisci una data valida, di oggi o precedente.'],
  ];
  for (const [draft, expected] of drafts) {
    const result = incidentSubmission(draft, Date.parse('2026-11-16T20:00:00Z'));
    assert.equal(result.ok, false);
    assert.equal(contributionError(result.error, t, format.currency), expected);
  }
  assert.equal(contributionError('Unrecognized internal error', t, format.currency), 'Controlla il modulo e riprova.');
});

test('feedback, star accessibility, missing states and safety disclaimers interpolate in either language without optional Intl APIs', () => {
  const descriptors = ['PluralRules', 'RelativeTimeFormat'].map((key) => [key, Object.getOwnPropertyDescriptor(Intl, key)]);
  try {
    for (const [key] of descriptors) Object.defineProperty(Intl, key, { configurable: true, value: undefined });
    for (const language of ['en', 'it']) {
      const t = createTranslator(language), format = createLocaleFormatters(language);
      assert.ok(t('How was {name}?', { name: 'Luna Rossa' }).includes('Luna Rossa'));
      assert.ok(t('{name}: {price} saved for this demo session.', { name: 'Aperol Spritz', price: format.currency(650) }).includes(format.currency(650)));
      assert.ok(t('Reported {date}', { date: format.dateTime('2026-11-15T20:30:00Z', 'UTC') }).includes('2026'));
      assert.ok(t('Updated {time}', { time: format.relativeTime(0, 120000) }).includes(language === 'it' ? '2 minuti fa' : '2 minutes ago'));
      assert.equal(t('{label}: {count} stars out of 5', { label: t('Cleanliness'), count: 1 }), language === 'it' ? 'Pulizia: 1 stella su 5' : 'Cleanliness: 1 star out of 5');
      assert.equal(t('{count} reviews', { count: 1 }), language === 'it' ? '1 recensione' : '1 review');
      assert.equal(t('{count} prices', { count: 0 }), language === 'it' ? '0 prezzi' : '0 prices');
      assert.equal(t('DEMO DATA'), language === 'it' ? 'DATI DEMO' : 'DEMO DATA');
      assert.equal(t('Saved in demo only — pending moderation'), language === 'it' ? 'Salvata solo nella demo — In attesa di moderazione' : 'Saved in demo only — pending moderation');
      assert.ok(t('This preview contains no real verified safety records. Missing information does not guarantee safety.').length > 50);
      assert.ok(t('No reported EUR prices for {name}, {volume} ml.', { name: 'Gin & Tonic', volume: 300 }).includes('Gin & Tonic'));
    }
  } finally {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(Intl, key, descriptor);
      else delete Intl[key];
    }
  }
});

test('language changes leave active price, venue-language and private incident drafts unchanged', async () => {
  const store = createLanguageStore({ persistent: true, getItem: async () => 'en', setItem: async () => {} });
  await store.initialize();
  const price = Object.freeze(priceDraftReducer({ drinkId: mockDrinkCatalog[0].id, euros: '' }, { type: 'price', euros: '6,50' }));
  const suggested = languageDraftReducer(null, { type: 'select', code: 'fr' });
  const incident = Object.freeze(incidentDraftReducer({ category: 'Harassment', description: '', date: '2026-11-15' }, { type: 'description', description: 'Private user-entered text {name}' }));
  const snapshot = JSON.stringify({ price, suggested, incident });
  for (const language of ['it', 'en', 'it']) {
    await store.select(language);
    const t = createTranslator(language);
    assert.ok(t(incident.category).length > 0);
    assert.ok(venueLanguageLabel(suggested, t).length > 0);
    assert.equal(JSON.stringify({ price, suggested, incident }), snapshot);
  }
  assert.equal(parseEuroPrice(price.euros).value, 650);
  assert.equal(incidentSubmission(incident, Date.parse('2026-11-16T20:00:00Z')).value.category, 'Harassment');
  assert.equal(incident.description, 'Private user-entered text {name}');
});

test('Rankings uses a short Italian badge label and a circular badge that accommodates phone font scaling', () => {
  assert.equal(createTranslator('en')('RANKED'), 'RANKED');
  assert.equal(createTranslator('it')('RANKED'), 'LOCALI');
  assert.equal(createTranslator('it')('{count} bars ranked', { count: 4 }), '4 locali in classifica');
  for (const phoneWidth of [320, 375, 390, 430]) {
    for (const scale of [0.8, 1, 1.3, 1.6, 2, 3.2]) {
      const badge = rankingBadgeSize(scale);
      // Content margins (18 each), card padding (16 each), and two 1-point borders.
      const cardInteriorWidth = phoneWidth - 36 - 32 - 2;
      assert.equal(badge.width, badge.height, 'The badge remains circular.');
      assert.ok(badge.width <= cardInteriorWidth, 'The badge fits within the phone card.');
      assert.ok(badge.height / Math.max(1, scale) >= 67, 'Larger text retains its badge space.');
    }
  }
});

test('saved and corrected price prefills use the selected locale and round-trip to identical integer cents', () => {
  for (const language of ['en', 'it']) {
    const format = createLocaleFormatters(language);
    let draft = { drinkId: null, euros: '' };
    for (const cents of [700, 725, 50, 10000]) {
      draft = priceDraftReducer(draft, {
        type: 'select', drinkId: mockDrinkCatalog[0].id, savedCents: cents,
        prefilledEuros: format.decimal(cents / 100, 2),
      });
      assert.equal(draft.euros, language === 'it' ? (cents / 100).toFixed(2).replace('.', ',') : (cents / 100).toFixed(2));
      assert.deepEqual(parseEuroPrice(draft.euros), { ok: true, value: cents });
    }
    assert.equal(priceDraftReducer(draft, { type: 'select', drinkId: mockDrinkCatalog[1].id, savedCents: null }).euros, '');
  }
  assert.deepEqual(parseEuroPrice('7.00'), { ok: true, value: 700 });
  assert.deepEqual(parseEuroPrice('7,00'), { ok: true, value: 700 });
});

test('typing is not reformatted and switching language leaves saved price history intact', async () => {
  const device = createLanguageStore({ persistent: true, getItem: async () => 'it', setItem: async () => {} });
  await device.initialize();
  let draft = priceDraftReducer({ drinkId: null, euros: '' }, {
    type: 'select', drinkId: mockDrinkCatalog[0].id, savedCents: 700,
    prefilledEuros: createLocaleFormatters('it').decimal(7, 2),
  });
  const observations = venueExtrasReducer(initialVenueExtrasState, { type: 'observe-price', observation: {
    id: 'e98f6a21-fc7c-47dd-a82d-000000000001', bar_id: mockVenues[0].id,
    drink_id: mockDrinkCatalog[0].id, price_cents: 700, currency: 'EUR',
    submitted_by: SESSION_USER_ID, observed_at: '2026-11-15T20:30:00Z',
  } });
  const before = JSON.stringify(observations);
  for (const typed of ['7,', '7.', '7,0', '7.00', '7,00']) {
    draft = priceDraftReducer(draft, { type: 'price', euros: typed });
    await device.select(device.getSnapshot().language === 'it' ? 'en' : 'it');
    assert.equal(draft.euros, typed);
    assert.equal(JSON.stringify(observations), before);
    assert.equal(observations.priceObservations[0].price_cents, 700);
  }
  draft = priceDraftReducer(draft, {
    type: 'select', drinkId: mockDrinkCatalog[0].id, savedCents: 700,
    prefilledEuros: createLocaleFormatters('en').decimal(7, 2),
  });
  assert.equal(draft.euros, '7.00');
  assert.equal(priceDraftReducer(draft, { type: 'cancel' }).euros, '');
  assert.equal(JSON.stringify(observations), before);
});
