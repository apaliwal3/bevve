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

`connect.ts` is a manual connection check that uses the existing service functions against your Supabase project. It creates a client with session persistence disabled, signs in with an existing test account, and prints:

- The signed-in user's profile.
- The first page of bars (up to 50).
- The crowd summary for the first returned bar, if any bars exist.

After sign-in succeeds, the script signs out in a `finally` block, including when a subsequent read fails. It does not create accounts, apply migrations, seed the database, or submit reports.

Apply the migration and optional demo seed first, then create and confirm a test account as required by your Supabase Auth settings. Add the following to `barhop-backend/.env`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=sb_publishable_YOUR_KEY
TEST_EMAIL=your-test-account@example.com
TEST_PASSWORD=your-test-account-password
```

Keep `.env` out of Git. `TEST_EMAIL` and `TEST_PASSWORD` are local test credentials; do not give them an `EXPO_PUBLIC_` prefix or embed them in the mobile app.

From `barhop-backend`, using Node.js 24 or newer, run:

```sh
node --env-file=.env connect.ts
```

With the demo seed, expect a profile, three bars, and a crowd summary with `report_count: 0` and null score, timestamp, and classification until reports are submitted. Missing Supabase configuration usually means the `.env` variable names do not match those read by the script. Authentication errors require checking the test credentials and account confirmation status.

A successful run checks authentication and these read paths. Complete `docs/database-checks.md` separately to verify ownership restrictions, write permissions, and moderation behavior.

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

Four local algorithm/validation tests passed during creation. Dependency installation was blocked by unavailable network access, so the full TypeScript check was not run. No Supabase project or PostgreSQL runtime was available: the SQL migration, RPCs, authentication flow, and access rules still require the database checks provided here. No remote resources were created.

## References

This structure follows the supplied BarHop plan and Supabase documentation:

- https://supabase.com/docs/reference/javascript/initializing
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/database/functions
