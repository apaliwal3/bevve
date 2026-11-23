# Backend architecture

```text
Expo mobile app
        |
TypeScript service functions
        |
Supabase Auth + database API
        |
PostgreSQL constraints + row-level security + RPCs
```

## Responsibilities

Supabase Auth manages credentials and sessions. `profiles` stores editable preferences, without an editable role field. An auth trigger creates profiles for new accounts; existing auth accounts would need a separate profile backfill.

`bars`, `drinks`, and `bar_languages` form an administrator-maintained catalog. All API access in this starter requires sign-in, including catalog reads. Anonymous browsing can be added later with deliberate read policies.

Crowd reports are append-only. The aggregate uses the most recent report per user per venue from the last 45 minutes, with a deterministic tie-breaker. It returns the mean, independent contributor count, and newest timestamp. Classification is null below three contributors; otherwise mean below 2 is quiet, below 3.5 is moderate, and the rest is busy. No reports returns a null score and zero count. Raw reports are visible only to their authors. Counts refer to accounts, not verified unique people.

Prices are append-only observations in integer cents. Comparison uses the exact standardized drink/serving size and currency and selects the latest observation per venue. Missing prices produce no row; they are not treated as zero. Observation date is the server submission time. Raw records, including submitter IDs, are not readable by clients; comparison exposes only price, venue, currency, and timestamp.

Bathroom reviews have one row per user and venue. Users can replace their own ratings. Five means better for every field, so a wait-time rating of 5 means a short wait. Accessibility is a subjective review, not a verified facilities assessment. Optional fields remain null when unknown, and aggregate responses include their own contributor counts.

Pairwise comparisons are private and append-only. Personal Elo ratings start at 1000 and use K=32. Services retrieve all pages and replay in timestamp/ID order. This is a prototype algorithm; a very large history should move to server-side calculation or a maintained ranking snapshot. Concurrent submissions during pagination can require a subsequent refresh.

Migration 003 adds `submit_personal_comparison`: a definer RPC with an empty search
path that derives ownership from Auth, requires saved impressions for both venues,
assigns time on the server and returns an immutable vote. A UUID identifies one
explicit choice; identical retries return that vote and conflicting reuse fails.
The original table grants are unchanged. The mobile store confirms writes before
updating rankings and retains uncertain choices for retry with the same ID.
History refresh can also recover a committed vote whose response was lost.

Account batches offer at most three distinct experienced opponents. They remain
in memory across route/modal changes, reset on restart/sign-out, and never upload
guest history. Rankings restore exclusively from owned server votes; impression
edits and skips do not alter Elo. Raw scores remain outside the account UI context.
Migration 003 is locally tested; the owner confirmed hosted deployment on
2026-11-23. Actual hosted API/device checks remain unverified.

Safety reports remain private to their reporter and moderators. A privileged database function checks a separate moderator allowlist, locks the report, records the decision, and creates a separate public summary in one transaction. Each report can be reviewed once. A private table links reports to publications. Corrections, withdrawal, and appeals need a later audited workflow. Do not include personal information in public summaries.

## Connected catalog and impressions

Migration 002 adds nullable venue metadata and a paginated catalog RPC that returns
public summaries, languages and latest EUR prices per exact catalog drink. Raw
submitter IDs are not exposed. Clients preserve database UUIDs; guest fixtures
never act as database records. Native app reads use validated shared DTOs.

`venue_impressions` stores one answer per user/venue. Authenticated clients can
read/write only their own rows and cannot set timestamps or community eligibility.
Edits replace the answer and receive a server timestamp. Public opinion reads
expose only eligible counts/percentages, exclude sample venues, include neutral
and disliked answers in the denominator, and require no minimum opinion count.
Impression writes never create comparison votes.

Mobile source state is scoped to the signed-in account. Confirmed writes update
cards/Profile, failed writes keep drafts, and stale requests cannot overwrite a
newer acknowledged save or populate the next account. Guest fixtures/session
submissions are separate and are never uploaded. The hosted catalog remains
administrator-maintained; missing metadata/distance values are not fabricated.

Migration 004 connects account crowd reports, bathroom edits and drink prices in
the existing optional inline forms. Crowd and price RPCs bind a request UUID to
one immutable owner/payload, allowing identical retries after lost responses.
Bathroom writes use the existing per-owner/venue upsert with server timestamps.
Legacy null category values stay unknown until the user selects them. The
own-price history RPC filters by `auth.uid()` and EUR without granting raw table
access. Crowd/bathroom reads retain their existing own-only policies.

The account contribution store pages through histories, scopes its lifetime to
one signed-in user, confirms writes before updating Profile, and invalidates
catalog summaries after a save. Catalog invalidation queues a follow-up if an
older read is still pending. Uncertain writes retain their payload/request ID
within the session. Append-only writes can also recover from refreshed server
history; bathroom retries upsert the same review. No contribution action changes
Elo or uploads guest state. The owner confirmed migration 004 was deployed through
SQL Editor on 2026-11-23. Actual hosted RPC/device checks remain unverified.

## Venue-language suggestions

Migration 005 adds `language_suggestions` with owned history and moderator read
access. Direct client writes are denied. Submission derives ownership from Auth,
validates a shared language vocabulary and assigns pending status/server time.
Private request receipts bind IDs to suggestions, including when multiple devices'
requests coalesce to one pending record. Replay after review returns that same
record. Rejected history survives a later new suggestion. Account service reads
explicitly filter the owner even when that owner is a moderator.

The review RPC checks `private.moderators`, locks the suggestion, and atomically
records approval/rejection. Approval inserts only the approved language into
`bar_languages` without replacing existing evidence. Matching decision retries
are idempotent; opposite decisions cannot replace an earlier review. Published
venue languages contain no suggestion IDs or authors. Interface preferences and
comparison votes are independent.

The separate mobile language store preserves uncertain submission/review payloads,
ignores late account results, protects writes from older reads and refreshes on
foreground/periodic/manual reads. Own history and the moderator queue have separate
load/error states; language failures cannot disable other contributions. Confirmed
writes and history refresh invalidate catalog summaries. Guest forms remain local.
The owner confirmed migration 005 deployment and its hosted SQL check passed on
2026-11-23. Detailed API/device outcomes have not been recorded.

## Connected private incidents and published safety

Migration 006 retains the original report/publication tables, policies and legacy
moderation behavior. Submission derives reporter identity/server time and binds a
request UUID to the original venue/category/description/date. Identical retries
return the same row, including after moderation. Invalid or conflicting payloads
fail. Mobile forms use existing category/local-date validation. Account drafts and
uncertain submissions stay in memory across navigation, reset on restart/sign-out,
and clear only after a confirmed write. No guest data enters an account.

Personal history explicitly filters `reporter_id`, even for moderators. The separate
queue checks the private moderator allowlist and pages only pending reports. Its
public-summary draft starts blank, never receives private text/identity automatically,
and persists across navigation. Reviews lock the original decision and summary after
an uncertain response. The new review RPC serializes on the report row and delegates
pending decisions to the existing atomic moderation RPC. Identical decision/summary
retries return the saved status; conflicting decisions or summaries cannot publish
again. The legacy endpoint keeps its original behavior.

Venue details read only a projected `published_incidents` DTO: publication/venue IDs,
summary, review label and publication time. Private descriptions, reporter IDs and
report IDs do not enter this public state. Own history, moderation access and each
viewed venue have independent loading/error states and account lifetimes. Approval
invalidates viewed public summaries and queues a fresh read if an older one remains
in flight; stale reads cannot erase confirmed private writes/reviews. Foreground,
periodic and manual refresh restore cross-device statuses and publications. No safety
action changes Elo or public activity counts. Migration 006 and rollback checks pass
locally; hosted deployment, SQL/API checks and device behavior remain unverified.

## Not yet implemented

- Full generated TypeScript database types. Current service queries rely on Supabase's default client typing; generate types from the deployed schema and parameterize the client before expanding the project.
- Submission throttling, account abuse prevention, and operational monitoring. Latest-per-account crowd aggregation is not a rate limiter.
- Account deletion/export, retention rules, moderation audit history, and publication withdrawal.
- Venue catalog editing tools and provenance for real venue data.
- Proximity search, geographic indexes, push notifications, image storage, and Realtime subscriptions.
- Additional offline caching and realtime updates; catalog reads currently refresh on demand/foreground.

The initial SQL deliberately restricts access, protects server timestamps through column-level grants, and keeps moderators outside user-editable profiles. Hosted read checks, the two SQL access scripts and the impression API write check passed on 2026-11-22; remaining API/device scenarios still need their own checks.
