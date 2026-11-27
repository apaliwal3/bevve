# English interface copy and formatting

The app is English-only. `language-provider.tsx` always provides an English
translator, English number/date/currency formatters and fixture-description
formatting. It does not load language storage and exposes no language switch.
Old `bevve.interface-language.v1` values are ignored, including Italian values.

Use `useTranslation()` for typed UI copy and interpolation:

```tsx
const { t, format } = useTranslation();
const title = t('Profile');
const price = format.currency(650);
```

Venue spoken-language codes remain venue data. They do not change the interface.
User names, venue names, neighborhoods and user-authored text are never translated.

The older Italian dictionary, pure translation helpers and language-store tests
are retained for compatibility with existing internal tests; none offers an
Italian interface in the running app. The active provider uses English only.
`tests/english-only.test.mjs` verifies this boundary without reading device storage.
Native AsyncStorage is now used separately for Supabase sessions; this provider
never reads or writes authentication data.
