# bevve

bevve is a nightlife discovery project focused on Milan. The maintained frontend
is the native React Native application in `mobile/`, with bevve's approved dark
navy and purple interface.

Supabase authentication and account-profile reads are connected. Venue discovery,
contributions and personal rankings still use fictional fixtures and shared
in-memory demo state; these features are not yet persisted to the database.

## Implemented features

- Explore venues by name or neighborhood, with Nearby, Cheap, Quiet and Popular
  filters, venue photographs and missing-data states.
- Bar Details with community-opinion availability, your saved impression, crowd information,
  bathroom summaries, drink prices, spoken languages and safety disclaimers.
- A top-down `+` overlay: save a impression, complete or skip up to three distinct
  personal comparisons, then use five optional inline forms for crowd, bathrooms,
  prices, language suggestions and private demo incidents. Saved progress can resume.
- Compact horizontal impression choices. Saved venues offer explicit **Compare
  this bar again** or **Resume comparisons**, plus direct access to contributions.
  Reopening never creates a new batch or a vote automatically.
- Read-only drink price comparison for the same catalog drink and serving size,
  using the latest observation at each venue.
- Personal pairwise comparisons and ordinal rankings. Internal Elo values remain
  hidden and independent of impressions and community opinions.
- Three persistent main tabs: Explore, Rankings and Profile. Add impressions and
  comparisons through a venue's `+` overlay; drink price comparison stays separate.
- An English-only interface and a Profile with demo activity counts.
- Real Supabase Login/Signup, email-confirmation handling, native session
  restoration, account-profile reads and local-device sign-out.

## Technology

- Frontend: Expo SDK 58, React Native 0.88, React 19 and TypeScript 6.
- Navigation: Expo Router; native safe-area handling and reusable UI components.
- Design: centralized theme, bundled DM Sans and Manrope fonts.
- Copy and formatting: typed English messages and locale-aware number formatting.
- Authentication: Supabase client with native AsyncStorage session persistence.
- Tests: Node.js test runner for state, algorithms, validation and localization.
- Backend foundation: separate Supabase/PostgreSQL migrations, services and tests.

## Repository structure

```text
mobile/                         Native Expo application
  src/app/                      Expo Router routes
  src/app/(tabs)/               Explore, Rankings and Profile tabs
  src/components/               Reusable native UI
  src/features/                 Feature screens, providers and state helpers
  src/constants/                Theme and design tokens
  src/fixtures/                 Typed UUID-based demo catalogs
  src/localization/             Dictionaries, language state and formatters
  tests/                        Mobile tests
  assets/                       Fonts, images and icon assets
bevve-backend/                 Supabase backend foundation
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
npm --prefix bevve-backend test
```

These tests do not validate a deployed database or its access policies. Refer to
the [backend README](bevve-backend/README.md) for its setup and database checks.
Mobile bundling and configuration commands are in the [mobile README](mobile/README.md#validation).
ESLint uses the official Expo flat configuration and reports findings without applying fixes.

## Team workflow

1. Create a focused branch from the team's agreed integration branch.
2. Keep frontend changes in `mobile/`. Agree API and data-contract changes with
   the backend maintainers.
3. Run the relevant checks and test changed screens on an iPhone in
   English, including keyboard, safe-area and larger-text behavior.
4. Submit a pull request describing the change, validation and remaining
   limitations. Review the diff for generated files and credentials before merging.

## Languages and demo boundaries

The interface is English-only. The former language switch is removed and any
previously saved Italian preference is ignored. Venue spoken-language information
remains venue data. See the [copy and formatting guide](mobile/src/localization/README.md).

Impressions, reports, price observations, pending language suggestions, private
incident drafts/submissions and personal comparisons are local demo data.
Demo activity survives navigation; a full reload or an account change clears it.
Accounts are real, but venue activity has no cross-device persistence or live
multi-user source yet. Sign-out clears the local session and demo activity.

Rankings and Profile guide users to Explore and a bar's `+` action. The former
standalone personal Compare screen is retired. Legacy `/compare` links redirect
to Rankings outside the tab navigator, reusing existing tab history or replacing
the compatibility route for a direct link. Old `returnTo=compare` contexts also
return to Rankings. Explore, Rankings, Profile and drink-price Back destinations
retain their existing behavior.

Overall bar stars and their fictional fixture baselines are retired. Explore and
Bar Details show that community opinions are unavailable in this demo; a saved
answer appears separately as **Your impression**. Profile counts one current
impression per venue, including edits. Bathroom categories and crowd reports
retain their separate five-point scales.

The pure community helper accepts explicitly eligible community impressions,
counts each user's latest eligible answer once per venue, and calculates
`liked / total distinct opinions * 100`. Fine and disliked answers remain in the
denominator. There is no minimum: a genuine zero shows **No opinions yet**, and
one or more genuine opinions shows the rounded percentage with the opinion count.
Demo answers and historical star fixtures cannot supply those statistics. There
is currently no genuine community source connected to the frontend.

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

`bevve-backend/` contains database migrations, services and executable checks.
Mobile authentication connects to the same project using public configuration in
`mobile/.env.local`; passwords and backend test credentials are never copied there.
See [mobile setup](mobile/README.md#supabase-authentication). Venue integration must
still replace fixture reads and session writes with authenticated services,
server-owned identifiers/timestamps, typed adapters and loading/error handling.

Outstanding contracts include authenticated per-user venue impressions and eligible
community-opinion reads, pending
venue-language suggestions, frontend venue metadata and authorized contribution
history reads. Mobile fixture UUIDs and drink servings differ from the backend
seed and must not be matched by display name. Guest venue-read policy and the missing feature contracts remain future work.
The hosted connection check and SQL access check passed on 2026-11-22; full
GoTrue/PostgREST write scenarios and mobile device checks remain separate validation.
