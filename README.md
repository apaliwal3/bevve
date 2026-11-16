# bevve

bevve is a nightlife discovery project focused on Milan. The maintained frontend
is the native React Native application in `mobile/`, with bevve's approved dark
navy and purple interface.

The mobile app is an interactive demo using fictional venue fixtures and shared
session state. It does not connect to Supabase or create authenticated accounts.

## Implemented features

- Explore venues by name or neighborhood, with Nearby, Cheap, Quiet and Popular
  filters, venue photographs and missing-data states.
- Bar Details with separate community overall ratings, crowd information,
  bathroom summaries, drink prices, spoken languages and safety disclaimers.
- A top-down `+` overlay: an overall rating unlocks five optional inline forms
  for crowd, bathrooms, prices, language suggestions and private demo incidents.
- Read-only drink price comparison for the same catalog drink and serving size,
  using the latest observation at each venue.
- Personal pairwise comparisons and ordinal rankings. Internal Elo values remain
  hidden and independent of community ratings.
- A demo Profile with activity counts and English/Italian interface selection.
- Login and Signup UI with validation and password visibility controls.
  Valid submissions explain that authentication is not connected.

## Technology

- Frontend: Expo SDK 58, React Native 0.88, React 19 and TypeScript 6.
- Navigation: Expo Router; native safe-area handling and reusable UI components.
- Design: centralized theme, bundled DM Sans and Manrope fonts.
- Localization: typed English/Italian dictionaries and native AsyncStorage for
  the interface-language preference.
- Tests: Node.js test runner for state, algorithms, validation and localization.
- Backend foundation: separate Supabase/PostgreSQL migrations, services and tests.

## Repository structure

```text
mobile/                         Native Expo application
  src/app/                      Expo Router routes
  src/app/(tabs)/               Explore, Compare, Rankings and Profile tabs
  src/components/               Reusable native UI
  src/features/                 Feature screens, providers and state helpers
  src/constants/                Theme and design tokens
  src/fixtures/                 Typed UUID-based demo catalogs
  src/localization/             Dictionaries, language state and formatters
  tests/                        Mobile tests
  assets/                       Fonts, images and icon assets
barhop-backend/                 Supabase backend foundation
```

## Run the mobile frontend

See [mobile setup](mobile/README.md) for Node.js prerequisites and iPhone
troubleshooting. From a repository checkout:

```sh
cd mobile
npm ci
npm start -- --go
```

Scan the terminal QR code with the iPhone Camera, open it in a compatible Expo
Go installation, then choose **Explore demo** on Welcome. No backend server,
Supabase environment variables or account are needed for this demo.

## Validation

From `mobile/`:

```sh
node node_modules/typescript/bin/tsc --noEmit --incremental false
node --experimental-strip-types --test tests/*.test.mjs
npm run lint
```

Backend logic tests are separate. From the repository root:

```sh
npm --prefix barhop-backend test
```

These tests do not validate a deployed database or its access policies. Refer to
the [backend README](barhop-backend/README.md) for its setup and database checks.
Mobile bundling and configuration commands are in the [mobile README](mobile/README.md#validation).
ESLint uses the official Expo flat configuration and reports findings without applying fixes.

## Team workflow

1. Create a focused branch from the team's agreed integration branch.
2. Keep frontend changes in `mobile/`. Agree API and data-contract changes with
   the backend maintainers.
3. Run the relevant checks and test changed screens on an iPhone in both
   languages, including keyboard, safe-area and larger-text behavior.
4. Submit a pull request describing the change, validation and remaining
   limitations. Review the diff for generated files and credentials before merging.

## Languages and demo boundaries

English is the default interface language. Profile can switch immediately to
Italian without resetting saved session activity. On native devices, only this
language preference survives a full reload. See the
[localization guide](mobile/src/localization/README.md).

Ratings, reports, price observations, pending language suggestions, private
incident drafts/submissions and personal comparisons are local demo data.
Saved session activity survives navigation; a full reload clears it. No real
accounts, cross-device persistence or multi-user backend behavior are implemented.

Crowd classification uses the latest report per contributor within 45 minutes
and requires three distinct contributors. The demo has one session user, so
repeated reports cannot create that consensus. Fictional crowd snapshots stay
separately labeled.

Prices are community-reported demonstration values, not verified offers.
Language suggestions remain pending. Incident reports are saved only in memory,
are not published, and do not reach a real moderation service. Safety sections
contain no real verified public records. Venue photographs require network
access unless cached; the Welcome image and fonts are bundled.

The visible app name is bevve. Approved platform icon assets are still needed;
see the [asset inventory](mobile/assets/README.md).

## Supabase integration boundary

`barhop-backend/` contains the backend foundation; its presence does not mean the
mobile app uses it. Future integration must replace fixture reads and session
writes with authenticated services, server-owned identifiers/timestamps, typed
adapters, and loading/error handling.

Outstanding contracts include community overall bar ratings, pending
venue-language suggestions, frontend venue metadata and authorized contribution
history reads. Mobile fixture UUIDs and drink servings differ from the backend
seed and must not be matched by display name. Authentication/session handling,
guest-read policy and database integration checks remain future work.
