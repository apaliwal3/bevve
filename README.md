# bevve

bevve is a nightlife discovery project focused on Milan. The maintained frontend
is the native React Native application in `mobile/`, with bevve's approved dark
navy and purple interface.

Signed-in users load the venue catalog from Supabase and save one editable
impression per venue to their account. Authentication, profile reads, public venue
summaries and read-only drink price comparison are connected. Guest browsing keeps
the original fictional, in-memory demo. The interface is English-only.

## Connected account features

- Database venue IDs, optional metadata, photographs, languages, crowd/bathroom
  summaries and latest EUR prices. Missing metadata stays unavailable.
- Search by name/neighborhood and All, Cheap, Quiet and Popular filters. Nearby
  is omitted until a real user location is available; fixture distances are not used.
- A venue's `+` action saves/edits an impression. Profile and cards update only
  after the server confirms the write. Failures retain the draft for retry.
- Impressions reload across sessions/devices, remain private to their owner, and
  count once per venue. Server timestamps and eligibility cannot be set by clients.
- Community percentages use eligible distinct-user database impressions. Sample
  venues are excluded; genuine zero opinions stays separate from unavailable data.
- Catalog loading/error/retry states, manual refresh, foreground refresh and
  account-change isolation. Failed reads never fall back to guest fixtures.

Signed-in comparisons and other contribution writes are not connected in this
stage. Rankings shows a coming-soon state; the full demo flow remains available
when signed out. Price comparison uses the database drink UUID and serving size.

## Guest demo features

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

While signed out, impressions, reports, price observations, language suggestions,
private incidents and comparisons are local demo data. A reload or account change
clears them. Guest demo activity is never uploaded or merged into an account.
Signed-in impressions are persisted and survive reload/sign-out; signing out clears
only their local view. Sample venues remain explicitly labeled even when their
catalog rows and personal impressions come from the database.

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
Demo answers and historical star fixtures cannot supply those statistics. Signed-in
real venues use the database aggregate; guest and sample venues show unavailable.

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

## Supabase integration

`bevve-backend/` contains migrations, services and checks. Apply migrations in
order on a fresh project; on the existing project, only
`002_catalog_impressions.sql` was needed for this stage. The hosted project owner
applied it and passed `supabase/tests/catalog-impressions.sql` on 2026-11-22.
These test scripts roll back their fixtures.

`mobile/.env.local` contains public project configuration only. No backend test
credentials or privileged keys belong there. `shared/venue-contracts.ts` contains
portable DTOs and runtime decoders; Metro watches that folder explicitly because
the two projects use separate dependency installs.

Run `npm --prefix bevve-backend run check:connection` for read-only checks. The
separate `check:impressions` command tests actual API writes and session reloads
on a sample venue, restoring a previous impression if one existed. Otherwise it
leaves one sample impression on the configured test account.

Remaining integration includes authenticated personal comparisons, crowd/bathroom/
price writes, pending venue-language suggestions, incident submission/moderation
UI, and contribution-history views. The legacy guest fixture UUIDs/servings are
not database IDs and are never matched to catalog rows by name.
