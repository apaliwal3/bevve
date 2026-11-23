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
- Search by name/neighborhood and All, Nearby, Cheap, Quiet and Popular filters.
  Nearby requests foreground location on tap, shows real venues within 1 km and
  sorts closest first. Cards/details show approximate straight-line distances.
- A venue's `+` action saves/edits an impression. Profile and cards update only
  after the server confirms the write. Failures retain the draft for retry.
- Impressions reload across sessions/devices, remain private to their owner, and
  count once per venue. Server timestamps and eligibility cannot be set by clients.
- Community percentages use eligible distinct-user database impressions. Sample
  venues are excluded; genuine zero opinions stays separate from unavailable data.
- Catalog loading/error/retry states, manual refresh, foreground refresh and
  account-change isolation. Failed reads never fall back to guest fixtures.

Personal comparisons and rankings are implemented for signed-in accounts using
the deployed `003_personal_comparisons.sql` migration. The venue `+` editor offers **Start comparisons** after saving impressions
for two venues. Only explicit picks affect rankings; impressions and skips do not.
Crowd reports, bathroom reviews and drink-price submissions are implemented for
accounts using the deployed `004_venue_contributions.sql` migration.
Price comparison uses the database drink UUID and serving size.

Comparison history restores from Supabase across sessions. Each batch offers at
most three distinct experienced opponents and survives navigation in the current
session; unfinished batches reset on app restart or sign-out. Retried choices
reuse a request ID, including when a server response was lost. Rankings and Profile
show confirmed comparison counts, with raw Elo values hidden. Guest activity is
never uploaded.

The same optional inline cards used in the demo appear below account comparisons.
Crowd submissions retain report history; only the latest report per contributor
within 45 minutes enters the crowd aggregate, with three contributors required
for a classification. Bathroom forms prefill the user's current review and edits
replace that review. Price submissions use database drink/serving IDs, accept EUR
amounts from €0.50 to €100, and append corrections without deleting earlier prices.
All three histories appear in Profile and restore across sessions. Confirmed
saves refresh public summaries; errors retain the pending details for retry.

Account spoken-language suggestions, private review history and a moderator
queue use migration `005_language_suggestions.sql`. The owner confirmed deployment
and passing hosted language-suggestion checks on 2026-11-23. Pending and rejected suggestions
stay out of venue languages. Approval adds the language and refreshes the catalog;
the interface remains English-only. Profile shows Pending, Approved and Rejected
statuses separately from the existing activity counts.

The account incident → moderation → published-summary flow is implemented for
`006_account_safety.sql`. The owner confirmed deployment and verification on 2026-11-23.
Venue `+` offers a private report without requiring an impression. Drafts and
uncertain submissions stay in the account session; Profile restores only that
reporter's history/statuses, including for moderator accounts. A separate moderator
queue requires a separately written public summary for approval. Only published
summary records appear on venue details; raw descriptions and reporter IDs never
feed that public view. No report or review affects rankings or activity counts.

Account location access starts only after selecting Nearby. Permission denial,
blocked access, disabled services, imprecise/stale readings and timeouts have
retry/settings controls. Foreground updates use device coordinates and real
database venue coordinates. Location stays in memory on the device, clears on
background/sign-out, and is never uploaded to Supabase. Sample venues have no real
distances; guest Nearby retains its explicitly fictional demo distances. No new
database migration is needed. Physical-device location verification remains pending.

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

Prices are community-reported, not verified offers. Guest values are fictional.
Guest language suggestions remain pending. Guest incident reports are saved only in memory,
are not published, and do not reach a real moderation service. Safety sections
contain no real verified public records. Venue photographs require network
access unless cached; the Welcome image and fonts are bundled.

The visible app name is bevve. Approved platform icon assets are still needed;
see the [asset inventory](mobile/assets/README.md).

## Supabase integration

`bevve-backend/` contains migrations, services and checks. Apply migrations 001–006
in order on a fresh project. On the existing project, 001–006 are deployed and must
not be rerun. The hosted project owner applied migration 002 and passed
`supabase/tests/catalog-impressions.sql` on 2026-11-22.
These test scripts roll back their fixtures.

`mobile/.env.local` contains public project configuration only. No backend test
credentials or privileged keys belong there. `shared/venue-contracts.ts` contains
portable DTOs and runtime decoders; Metro watches that folder explicitly because
the two projects use separate dependency installs.

Run `npm --prefix bevve-backend run check:connection` for read-only checks. The
separate `check:impressions` command tests actual API writes and session reloads
on a sample venue, restoring a previous impression if one existed. Otherwise it
leaves one sample impression on the configured test account.

The project owner confirmed on 2026-11-23 that migrations 003 and 004 were deployed
through Supabase SQL Editor. Migrations 001–004 must not be rerun on this project.
The corresponding
`supabase/tests/personal-comparisons.sql` and `supabase/tests/venue-contributions.sql`
checks roll back fixtures; hosted results for these two checks have not been
reported. Migrations 003/004 pass local PostgreSQL checks; hosted RPC/device
verification remains pending. The new own-price RPC exposes only
the caller's EUR history; raw price-table reads remain denied.

The owner confirmed migration 005 and the hosted language-suggestion SQL check
passed on 2026-11-23. Migrations 001–005 must not be rerun. Detailed language API/
physical-device outcomes have not been recorded. Moderator accounts use the existing private allowlist;
see the [backend setup](bevve-backend/README.md#venue-language-suggestions-migration-005).

The owner confirmed migration 006 was deployed and verified on 2026-11-23. Its
[`account-safety.sql`](bevve-backend/supabase/tests/account-safety.sql) check rolls
back fixtures and may be rerun; the migration must not be rerun. Detailed API and
physical-device scenarios were not enumerated in the confirmation. The agent
performed no hosted safety writes.

Remaining integration includes profile editing, password
recovery and catalog management. The legacy guest fixture UUIDs/servings are
not database IDs and are never matched to catalog rows by name.
