# Localization — English and Italian

bevve supports English (`en`) and Italian (`it`) interface languages. English is
the default when no valid saved preference is available.

Localization covers Welcome, Login, Signup, Explore, personal comparisons,
Rankings, Profile, bottom navigation and shared navigation headers. Detailed
Bar Details content, the rating overlay and contribution forms, and the price
comparison page body are not yet fully localized.

## Dictionaries and usage

- `en.ts` defines the English messages and typed translation keys.
- `it.ts` provides the same keys in Italian.
- `translation.ts` handles interpolation, plural selection and locale mapping.
- `language-provider.tsx` provides `LanguageProvider` and `useTranslation`.

`LanguageProvider` is installed in the root layout. Within a component, use
`useTranslation` to access translated messages, formatters, the current
`language` and `setLanguage`:

```tsx
const { t, format, setLanguage } = useTranslation();

t('Compare');
t('{count} comparisons', { count: 2 });
format.currency(650); // Formats 650 cents as EUR.
const selectItalian = () => { void setLanguage('it'); };
```

Bind `selectItalian` to a language selector's press handler.
Language changes update the interface immediately. Ratings, contributions,
personal comparisons and navigation remain managed by their existing providers.

## Adding or updating translations

1. Add each message to both dictionaries using the same key. Keys are English
   source-text identifiers; keep existing keys stable when changing display copy.
2. Use matching `{parameter}` names in both languages. For count messages, use
   `{ one, other }` variants and pass a numeric `count`.
3. Call `t` at render time. TypeScript checks keys and required arguments; tests
   check dictionary coverage, placeholders and plural variants.

Keep translated labels out of route parameters, filters and submission records.
Venue names, neighborhoods, drink names and user-entered content remain
unchanged. The interface language is independent of venue spoken-language data.

## Language preferences

On iOS and Android, `language-storage.native.ts` uses AsyncStorage 2.2.0 to save
only `en` or `it` under `bevve.interface-language.v1`. Credentials, private reports
and session activity are not persisted by this feature. The web adapter uses
memory only; it does not use browser localStorage or persist across page reloads.

The app waits for preference loading and fonts before displaying its screens.
Read failures fall back to English. Write failures retain the selected language
and show an error; selecting a language again retries the save. Writes are
serialized to preserve selection order.

## Locale-aware formatting

`formatting.ts` uses `en-GB` for English and `it-IT` for Italian. Currency helpers
accept integer EUR cents; they do not change stored price data. Date and timestamp
helpers use the device time zone unless an explicit zone is supplied, and return
`—` for invalid dates.

Plural and relative-time formatting include English/Italian fallbacks for
runtimes without `Intl.PluralRules` or `Intl.RelativeTimeFormat`.

## Tests

Run the type check and focused tests from `mobile/`:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test \
  tests/localization.test.mjs \
  tests/language-persistence.test.mjs \
  tests/localization-session.test.mjs
```

Tests cover dictionaries, formatting and runtime fallbacks, preference loading,
save failures and retries, and session-data selectors. They run in Node with
mocked storage. Also check language switching, persistence and formatted prices
and timestamps in Expo Go on a physical device.
