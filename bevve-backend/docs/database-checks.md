# Database integration checks

The read-only `npm run check:connection` (27 checks) and hosted `supabase/tests/access.sql`
passed on 2026-11-22. The access script rolls back its fixtures and can be rerun in
the SQL Editor. Local `npm test` exercises it against PostgreSQL with an Auth shim.

The script covers core profile/catalog ownership, server-controlled columns,
bathroom upsert/null aggregation, crowd deduplication/expiry, currency isolation,
comparison/incident privacy, moderation/publication and anonymous restrictions.
The full scenarios below also include API pagination, price latest/serving rules
and email-confirmation behavior that need separate verification.

Run remaining write scenarios against a test project after applying the migration
and seed.

Use three independently signed-in clients: user A, user B, and moderator M. Register the moderator in `private.moderators` using the project SQL Editor. Use the publishable key in every client. Do not test ownership using a service-role client, which bypasses row-level security.

1. **Authentication and profile:** signing up creates a profile; A can read/update A's username/language, cannot change the ID or creation timestamp, and cannot read B's profile. Email confirmation follows the project's Auth settings.
2. **Catalog:** signed-in users can read seeded venues/drinks/languages but cannot insert or edit catalog entries. Signed-out users cannot read them.
3. **Ownership:** inserting a crowd report, comparison, review, or incident with B's ID while authenticated as A fails. A cannot read B's comparisons, raw crowd reports, or bathroom reviews. A cannot edit B's review.
4. **Server-controlled columns:** client attempts to supply `created_at`, `observed_at`, incident `status`, or `reviewed_by` fail. Supplying an invalid score or negative price fails.
5. **Bathroom upsert:** A saves a bathroom review twice for the same venue; exactly one review exists with updated values and timestamp. B's review contributes separately. Null optional fields do not dilute averages and have zero field counts when all are absent.
6. **Crowd aggregation:** no reports returns count zero and null score/classification. A reporting twice counts once. With A/B/M reporting, the count is three and classification appears. In the project SQL Editor, age a test report beyond 45 minutes and confirm its exclusion. An older report from the same user must not replace their newest report.
7. **Price comparison:** submit two observations for the same bar/drink/currency. Only the newest returns. A different serving size or currency does not enter the comparison. Raw submitter identities are not exposed.
8. **Rankings:** A's comparisons affect only A's rankings. Reversing input order does not change the algorithm result. More than 500 comparisons are retrieved across pages.
9. **Private incidents:** A can see A's report, B cannot see it, and M can see it. A cannot set approval status directly, change their moderator status, or invoke moderation successfully.
10. **Publication:** M approving without a summary fails. M approving with a summary creates one publication and records the decision. The publication contains no reporter ID, report ID, or original description. A second decision on the same report fails without another publication. Rejection creates no publication.
11. **Anonymous RPCs:** signed-out clients cannot call crowd, bathroom, price comparison, or moderation functions. Ordinary signed-in clients can call the first three but cannot moderate.

Record outcomes and any database errors before treating the scaffold as an integrated backend.

## Catalog and impressions (migration 002)

The project owner applied migration 002 and passed
`supabase/tests/catalog-impressions.sql` on 2026-11-22. This script rolls back its
fixtures. It checks private per-user rows, ownership spoofing, upsert/edit,
protected timestamps/eligibility, true-zero/one-opinion aggregates, neutral and
disliked denominators, sample-venue exclusion, exact servings/latest EUR prices,
private submitter identities and signed-out access. Local tests also cover catalog
pagination beyond fifty rows and unchanged data after rollback.

`npm run check:impressions` verified actual PostgREST save, reload in a second
session and editing one current row. One sample impression remains on the test
account. This is separate from the read-only connection check. Physical-device
persistence, error handling and navigation checks are listed in the mobile README.

## Personal comparisons (migration 003)

The owner confirmed migration 003 was deployed through SQL Editor on 2026-11-23.
Do not rerun it. Run the whole `supabase/tests/personal-comparisons.sql` as postgres.
The latter rolls back all fixtures and is included in local PGlite tests. It
checks owner-derived writes, required impressions, request validation, immutable
timestamps/votes, identical retries, conflicting request reuse, cross-account
privacy and anonymous denial. Earlier migrations must not be rerun.

Hosted results for this SQL check and actual comparison RPC/device checks have
not been reported. Use two saved sample-venue impressions on the test account, explicitly
choose a winner, and verify a new session restores its ranking. Retry with the
same request ID and verify the history count increases only once. A new request
ID is a new vote; these append-only test votes cannot be deleted by the client.

## Venue contributions (migration 004)

The owner confirmed migration 004 was deployed through SQL Editor on 2026-11-23.
Run the entire `supabase/tests/venue-contributions.sql` as postgres
in SQL Editor. Do not rerun deployed migrations. The check rolls back fixtures.
It verifies retry-safe append-only writes, server identity/time, rejected conflicts,
exact drink/serving identity, preserved crowd/price history, bathroom edits/nulls,
updated public aggregates, own-only reads, anonymous denial and unchanged votes.
Local PGlite tests also check own-price pagination beyond 500 records and ensure
other owners/currencies remain excluded.

Hosted results for this SQL check and actual contribution API/device checks have
not been reported.
Use sample venues on the configured test account for later write smoke checks.
Repeat a request UUID to confirm only one crowd/price row is created. A fresh
request UUID is a new observation. Editing a bathroom review must keep its UUID
and creation time, and a new session must restore its current category values.
Verify another account cannot read or edit these contributions. Check price
comparisons by database drink ID and exact serving, never by name. These
append-only reports/prices cannot be deleted by the ordinary client.

## Venue-language suggestions (migration 005)

The owner confirmed migration 005 deployment and the hosted
[`language-suggestions.sql`](../supabase/tests/language-suggestions.sql) check passed
on 2026-11-23. Do not rerun migrations 001–005. The check rolls back temporary users, suggestions, receipts,
moderator membership and venue languages on success or failure. It can be rerun.
Local tests also deliberately break the read policy and verify the check fails.

Checks cover own-only history, explicit moderator history scope, pending-queue
access, denied direct writes and role changes, unsupported codes, invalid venues,
anonymous denial, request replay/conflict, coalesced pending requests and alias
replay after review. Approval publishes one venue language and is retry-safe;
rejection publishes nothing and preserves history. Preferences and votes stay
unchanged. The agent performed no hosted writes for this feature.

For remaining detailed PostgREST/device checks, use ordinary accounts A/B and
moderator M. Submit from A, confirm B cannot read it, inspect Pending in A's Profile,
then approve/reject as M. Refresh A's history and both clients' venue details;
only approval should add a language. Verify M's own history excludes A/B submissions.
Retry lost submission/review responses with unchanged IDs/decisions, and verify no
duplicate suggestion or public association. Check navigation, restart, sign-out
and another account. Pending operations remain session-only; confirmed statuses
restore from the database. Record hosted SQL/API and physical-device outcomes
separately; passing local PostgreSQL checks does not establish those outcomes.

## Private incidents, reviews and published summaries (migration 006)

The owner confirmed migration 006 was deployed and verified on 2026-11-23. Do not
rerun migrations 001–006. The entire [`account-safety.sql`](../supabase/tests/account-safety.sql)
may be rerun as postgres in SQL Editor. The check rolls back all test accounts, moderator
membership, reports, publications, private links and the temporary venue on success
or failure. Local tests also deliberately break report read privacy and verify
the check fails with no retained fixtures. No hosted safety writes were performed.

Checks cover owner-derived identity/time, required form category/description,
invalid/future/non-finite dates, stable request retries, payload/owner conflicts,
private history, explicit moderator personal-history scope, queue access, rejected
role/status/publication writes and anonymous denial. Invalid reviews publish nothing.
Approval creates one separately supplied summary, rejection creates none, and matching
decision/summary retries cannot duplicate a publication. Conflicting review changes
fail. Reporter IDs, private descriptions, review identity and original report IDs
are absent from the public table schema; raw private-public links stay inaccessible.
No report/review creates comparison votes. Legacy access/moderation checks still pass.

Record these detailed API/device outcomes with A/B/M accounts:

1. A opens a database venue's `+` without saving an impression, writes a report draft,
   closes/reopens it, and submits. A's history shows Pending and B cannot read it.
2. M sees it in the private queue, while M's personal history excludes A's report.
   The public-summary field starts blank. Approval requires separately written text
   with no identifying details. A's history becomes Approved and venue details show
   only that summary, review label and publication time. Rejection publishes nothing.
3. Lost submission/review responses retry the same request ID/decision/summary and
   do not add rows. Navigation preserves pending details; restart/sign-out resets
   drafts/pending requests and restores confirmed history in a new session.
4. Check rapid taps, stale reads during review, foreground/manual refresh, empty and
   unavailable public information, optional date/timezone handling and account isolation.
   Private details never appear in another ordinary account or the public view.

Hosted deployment/verification is confirmed by the owner. These individual API/
physical-device outcomes were not enumerated; local tests do not establish them.

## Nearby/location

This stage uses existing real venue coordinates and computes distance locally in
mobile. No new migration or hosted writes are required. User device coordinates
never enter the database. Physical-device permission, accuracy, movement, background,
restart and account-isolation checks are listed in the mobile README. Only real
non-demo venues participate in Nearby; fictional seed coordinates are excluded.
