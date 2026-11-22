# Bevve backend starter

A backend foundation for the bevve plan: database schema, access rules, database functions, and TypeScript services. No UI, Expo project, or web server is included. This is a starter to connect and validate against your own Supabase project.

## Files to start with

- `supabase/migrations/001_backend.sql`: tables, constraints, authentication profile trigger, row-level security, crowd/bathroom aggregates, price comparison, and moderation.
- `supabase/migrations/002_catalog_impressions.sql`: mobile catalog metadata, aggregate reads and private per-user impressions.
- `supabase/migrations/003_personal_comparisons.sql`: retry-safe explicit comparison submission with owner and timestamp assigned by the server. Prepared and locally tested; hosted application is pending.
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

3. Create an empty Supabase project. In its SQL Editor, run `supabase/migrations/001_backend.sql`, then `002_catalog_impressions.sql`, followed by `supabase/seed.sql`. The migration is a one-time initial migration; use a fresh database rather than rerunning it. The seed script can be rerun.
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

Local PostgreSQL tests cover all three migrations, repeatable rollback checks, a broken
ownership policy, and catalog pagination beyond fifty rows. These do not replace
physical-device checks or full GoTrue/PostgREST write coverage for the remaining
features. Mobile catalog reads and impression writes are connected. Personal
comparisons and ordinal rankings are implemented and require migration 003;
other contribution writes remain guest-demo-only.

On the existing hosted project, apply **only** migration 003, then run the entire
`supabase/tests/personal-comparisons.sql` in SQL Editor. The check rolls back all
fixtures and verifies ownership, required saved impressions, immutable votes,
server time, duplicate retries, conflicting request IDs and anonymous denial.
Do not rerun the already deployed 001/002 migrations. Local PostgreSQL checks pass;
hosted comparison RPC and physical-device verification are pending.

`rankingsService(client).submitComparison(winnerBarId, loserBarId, requestId)`
requires a UUID generated once for the explicit choice and reused for retries.
The RPC returns the confirmed vote and never updates an existing vote. Different
request IDs represent different explicit choices. It requires the caller to have
saved an impression for both venues. Existing history and original ownership/
column-level restrictions are preserved.

## References

This structure follows the supplied BarHop plan and Supabase documentation:

- https://supabase.com/docs/reference/javascript/initializing
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
