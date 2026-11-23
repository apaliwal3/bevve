# Bevve backend starter

A backend foundation for the bevve plan: database schema, access rules, database functions, and TypeScript services. No UI, Expo project, or web server is included. This is a starter to connect and validate against your own Supabase project.

## Files to start with

- `supabase/migrations/001_backend.sql`: tables, constraints, authentication profile trigger, row-level security, crowd/bathroom aggregates, price comparison, and moderation.
- `supabase/migrations/002_catalog_impressions.sql`: mobile catalog metadata, aggregate reads and private per-user impressions.
- `supabase/migrations/003_personal_comparisons.sql`: retry-safe explicit comparison submission with owner and timestamp assigned by the server. Locally tested; owner confirmed hosted deployment on 2026-11-23.
- `supabase/migrations/004_venue_contributions.sql`: retry-safe crowd/price writes and a private own-price history RPC. Locally tested; owner confirmed hosted deployment on 2026-11-23.
- `supabase/migrations/005_language_suggestions.sql`: private language suggestions, retry receipts and moderator approval/rejection. Owner confirmed deployment and passing hosted SQL checks on 2026-11-23.
- `supabase/migrations/006_account_safety.sql`: retry-safe private incident submission and review, plus moderator-access RPC. Locally tested; hosted deployment is unconfirmed.
- `supabase/seed.sql`: three fictional venues and two standardized drinks.
- `src/services/`: functions the future mobile app can call.
- `src/logic/eloRanking.ts`: personal rankings from pairwise comparisons.
- `tests/logic.test.ts`: executable ranking and validation tests.
- `connect.ts`: signs into Supabase and checks profile, venue, and crowd-summary reads.
- `docs/architecture.md`: responsibilities, decisions, and remaining work.
- `docs/database-checks.md`: checks to perform after connecting Supabase.

## Setup

1. Install Node.js 22.6 or newer.
2. Open this directory in your editor and run:

   ```sh
   npm install
   npm test
   npm run check
   ```

3. On a fresh empty Supabase project, run migrations 001–006 in order in SQL Editor, followed by `supabase/seed.sql`. Each migration is applied once. On the existing configured project, 001–005 are deployed; run only 006. The seed script can be rerun.
4. Create `.env` in this directory with the project URL and **publishable** key, using the variable names in the connection check below. This starter does not load `.env` automatically; the check uses Node's `--env-file` option.
5. Use `authService` to create an account. Confirm the email when required by your project's authentication settings, then sign in. New accounts automatically receive a profile.
6. Complete `docs/database-checks.md` before sharing the app with others.

Example for a Node/TypeScript environment that loads `.env`:

```ts
import { createBarHopClient, authService, barsService, crowdService } from './src/index.ts';

const client = createBarHopClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  { auth: { persistSession: false } }
);
const auth = authService(client);
await auth.signIn('YOUR_ACCOUNT_EMAIL', 'YOUR_ACCOUNT_PASSWORD');
const bars = await barsService(client).listBars();
console.log(bars);
// After selecting a venue:
// await crowdService(client).submitCrowdReport(barId, 3);
// console.log(await crowdService(client).getBarCrowd(barId));
```

For Expo later, pass `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` explicitly and configure a secure session storage adapter and token refresh lifecycle. The standalone starter deliberately has no React Native dependencies.

Never use a service-role or secret key in the mobile app. For a future web server, create a separate authenticated client per request; do not share a signed-in client between users.

## Check the Supabase connection

`connect.ts` signs in with an existing test account and runs 27 read-only
checks against the seeded project: profiles, catalogs, summaries, rankings,
incident reads, signed-out table access and signed-out RPC rejection. It prints
only check names and counts, never account records or credentials. Its local-scope
sign-out leaves other sessions for that account intact.

Apply the migration and optional demo seed first, then create and confirm a test account as required by your Supabase Auth settings. Add the following to `bevve-backend/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_YOUR_KEY
TEST_EMAIL=your-test-account@example.com
TEST_PASSWORD=your-test-account-password
```

Keep `.env` out of Git. `TEST_EMAIL` and `TEST_PASSWORD` are local test credentials; do not give them an `EXPO_PUBLIC_` prefix or embed them in the mobile app.

From `bevve-backend`, using Node.js 24 or newer, run:

```sh
npm run check:connection
```

With the unchanged demo seed, expect three venues and 27 passing checks. Missing Supabase configuration usually means the `.env` variable names do not match those read by the script. Authentication errors require checking the test credentials and account confirmation status.

For the original ownership, write permissions and moderation checks, run the entire
`supabase/tests/access.sql` in the project SQL Editor as postgres. It uses one
command for dependent checks and rolls back its test users, catalog entries,
contributions and helpers on success or failure. Saving the query in the dashboard
is optional; keep this repository file as the maintained version.

After applying migration 002, also run the entire
`supabase/tests/catalog-impressions.sql`. It verifies impression privacy/upserts,
server-controlled fields, demo exclusion, community percentages and catalog
serving/price contracts, rolling back all fixtures.

`npm run check:impressions` is a separate API write check using the existing test
account and an existing sample venue. It saves, signs in through a second client,
reloads and edits an impression. It restores a previous impression if one existed;
otherwise one sample impression remains. Other device sessions are not revoked.

`npm test` also runs the migration, seed and access script in an isolated PGlite
PostgreSQL runtime with a minimal Supabase Auth schema/role shim. It checks repeat
execution/rollback and deliberately breaks an ownership policy to ensure the
check fails. This does not replace hosted Auth, PostgREST or device verification.
See `docs/database-checks.md` for additional scenarios.

## Moderator setup

After the moderator has signed up, a project administrator can run the following in the Supabase SQL Editor, replacing the placeholder with the account's UUID:

```sql
insert into private.moderators(user_id) values ('MODERATOR_ACCOUNT_UUID');
```

Users cannot grant themselves this role. A signed-in moderator can retrieve pending reports with:

```ts
const { data, error } = await client.from('incident_reports')
  .select('*').eq('status', 'pending');
```

Use `safetyService(client).moderateIncident(reportId, 'approved', publicSummary)` to publish a reviewed summary, or pass `'rejected'` to reject it. Public records omit reporter identities and original descriptions. Review is not independent verification.

## Validation status

On 2026-11-22, all 27 hosted read-only checks passed. The project owner applied
migration 002 and passed the hosted catalog/impression SQL check. The API write
check also confirmed save, reload through a second sign-in session, and edit
without adding a second row. One sample impression remains on the test account.

Local PostgreSQL tests cover all six migrations, repeatable rollback checks, broken
ownership policies, and catalog pagination beyond fifty rows. These do not replace
physical-device checks or full GoTrue/PostgREST write coverage for the remaining
features. Mobile catalog reads and impression writes are connected. Personal
comparisons and ordinal rankings are implemented and require migration 003;
crowd/bathroom/price contributions require migration 004. Account language suggestions
and review UI require migration 005. Account incident submission, private history,
moderation and published-summary reads are implemented for migration 006.

The owner confirmed migrations 003 and 004 were deployed through Supabase SQL
Editor on 2026-11-23. Do not rerun migrations 001–004. The entire
`supabase/tests/personal-comparisons.sql` can be run in SQL Editor. The check rolls back all
fixtures and verifies ownership, required saved impressions, immutable votes,
server time, duplicate retries, conflicting request IDs and anonymous denial.
Local PostgreSQL checks pass; hosted results for this SQL check, actual comparison
RPC checks and physical-device verification have not been reported.

`rankingsService(client).submitComparison(winnerBarId, loserBarId, requestId)`
requires a UUID generated once for the explicit choice and reused for retries.
The RPC returns the confirmed vote and never updates an existing vote. Different
request IDs represent different explicit choices. It requires the caller to have
saved an impression for both venues. Existing history and original ownership/
column-level restrictions are preserved.

Migration 004 is deployed. `supabase/tests/venue-contributions.sql` can be run in
SQL Editor; it rolls back all fixtures. Local tests pass; hosted results for this
SQL check and actual contribution RPC/device verification have not been reported.

`submit_crowd_report(requestId, barId, level)` and
`submit_drink_price(requestId, barId, drinkId, priceCents)` derive the owner from
Auth and return the confirmed row. Reuse each request UUID when retrying the
same submission. Conflicting reuse fails. Price writes accept only EUR values
from 50 to 10000 cents and rely on catalog foreign keys for exact serving identity.
`get_my_drink_prices(offset)` returns only the caller's EUR history in stable
500-row pages. Raw price reads remain denied. Existing direct service writes
remain available for legacy clients; the connected mobile repository uses the
new retry-safe RPCs. Bathroom writes use the existing owned upsert/read contract,
preserve the row identity and original creation time, and return the saved review.

## Venue-language suggestions (migration 005)

The owner confirmed migration 005 was deployed, the language feature works, and
[`supabase/tests/language-suggestions.sql`](supabase/tests/language-suggestions.sql)
passed on Supabase on 2026-11-23. Do not rerun migrations 001–005. The SQL check
rolls back fixtures on success or failure and may be rerun. Detailed API/device
verification outcomes have not been recorded. No SQL administration connection
is available in this workspace.

`languagesService(client)` offers `getMySuggestions()`, `submitSuggestion(request)`,
`getModerationQueue()` and `moderateSuggestion(id, decision)`. A request contains
`{ id, barId, code }`; create the UUID once and reuse it on retries. Auth derives
the owner and the database supplies timestamps/status. Only the eight shared
catalog codes are accepted. Duplicate pending suggestions from the same account,
venue and language coalesce. Private receipts preserve every accepted request ID
so a retry after review returns the same suggestion. Reusing an ID for another
owner or payload fails. New requests after rejection preserve the older history.

The existing `private.moderators` allowlist controls review access. To designate
a moderator, deliberately choose a confirmed Auth user's UUID and run this in
SQL Editor as administrator, replacing the placeholder:

```sql
insert into private.moderators(user_id)
values ('YOUR_CONFIRMED_MODERATOR_AUTH_USER_UUID')
on conflict do nothing;
```

Clients cannot edit the allowlist, suggestion status, timestamps or approved
languages directly. Moderator own-history queries explicitly filter `user_id`;
the separate queue reads pending rows across contributors. Approval inserts the
language with community evidence without overwriting existing venue/demo evidence.
Rejection changes only private review history. Identical review retries are
idempotent; conflicting decisions fail. Pending/rejected rows never enter public
catalog languages, interface preferences or rankings. Ordinary accounts cannot
review; guests keep their separate in-memory forms.

## Account safety flow (migration 006)

On the existing hosted project, run only
[`supabase/migrations/006_account_safety.sql`](supabase/migrations/006_account_safety.sql),
then the whole [`supabase/tests/account-safety.sql`](supabase/tests/account-safety.sql)
in SQL Editor as postgres. The check rolls back fixtures on success and failure.
Migration 006, the original access check and a deliberately broken incident
privacy policy have been exercised locally. Hosted 006 deployment, safety SQL/API
results and physical-device verification are unconfirmed. No hosted safety writes
were performed during implementation.

Existing incident/publication tables, ownership policies, moderator allowlist and
the atomic legacy `moderate_incident` RPC are retained. New functions:

- `submit_incident_report(requestId, barId, category, description, occurredAt)` derives
  the reporter and timestamp, requires one of the four form categories, validates
  description/date and returns the private report. Identical request retries return
  the same row, including after review. Conflicting owner/payload reuse fails.
- `can_moderate_incidents()` checks the existing private allowlist. No client can
  grant itself moderator access.
- `review_incident_report(reportId, decision, publicSummary)` locks the report and
  uses existing atomic moderation. Approval requires a separately supplied summary;
  rejection requires null. Retrying the same decision/summary returns the reviewed
  row without another publication. Conflicting decisions/summaries fail. The legacy
  RPC retains its original one-decision behavior for existing clients.

`safetyService(client).submitIncident(request)` now takes
`{ id, barId, input: { category, description, occurred_at } }`. Retain its UUID for
retries. `getMyIncidentReports()` explicitly filters the authenticated reporter and
paginates beyond 500, including for moderators. `getModerationQueue()` separately
checks access and pages pending reports. `moderateIncident(id, decision, summary)`
uses the new retry-safe endpoint. `getPublishedIncidents(barId)` selects only the
public publication ID, venue ID, summary, review label and publication time; it
never requests a reporter, private description or original report ID.

Mobile drafts and pending submission/review payloads stay account-scoped in memory.
Confirmed writes update private state; failed/uncertain saves keep their details.
Public summaries have an independent store and error states. Approval invalidates
viewed venue summaries and queues a follow-up if an older read is pending. Guest
activity is never uploaded, and reports/reviews do not affect rankings or counts.
Moderators must write public text without identifying details; a private description
is never prefilled or copied into the public field automatically.

## References

This structure follows the supplied BarHop plan and Supabase documentation:

- https://supabase.com/docs/reference/javascript/initializing
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
