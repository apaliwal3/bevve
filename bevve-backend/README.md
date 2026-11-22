# Bevve backend starter

A backend foundation for the bevve plan: database schema, access rules, database functions, and TypeScript services. No UI, Expo project, or web server is included. This is a starter to connect and validate against your own Supabase project.

## Files to start with

- `supabase/migrations/001_backend.sql`: tables, constraints, authentication profile trigger, row-level security, crowd/bathroom aggregates, price comparison, and moderation.
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

3. Create an empty Supabase project. In its SQL Editor, run `supabase/migrations/001_backend.sql`, followed by `supabase/seed.sql`. The migration is a one-time initial migration; use a fresh database rather than rerunning it. The seed script can be rerun.
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

`connect.ts` signs in with an existing test account and runs 22 read-only
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

With the unchanged demo seed, expect three venues and 22 passing checks. Missing Supabase configuration usually means the `.env` variable names do not match those read by the script. Authentication errors require checking the test credentials and account confirmation status.

For ownership, write permissions and moderation, run the entire
`supabase/tests/access.sql` in the project SQL Editor as postgres. It uses one
command for dependent checks and rolls back its test users, catalog entries,
contributions and helpers on success or failure. Saving the query in the dashboard
is optional; keep this repository file as the maintained version.

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

On 2026-11-22, the hosted read-only connection checks passed (22 checks).
The project owner also ran the SQL access check successfully against Supabase.
Local TypeScript and algorithm/service/database tests are run with the commands
above. No feature-schema migration was required for this authentication step;
`001_backend.sql` was already deployed. The SQL access check leaves no test data.

Mobile authentication is connected separately in `../mobile/`; venue features
still use demo state. Price latest/serving cases, large-history service pagination,
full signup/email delivery and physical-device behavior remain separate checks.

## References

This structure follows the supplied BarHop plan and Supabase documentation:

- https://supabase.com/docs/reference/javascript/initializing
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
