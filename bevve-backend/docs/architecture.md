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

## Not yet implemented

- Remaining contribution-write and personal-comparison integration in mobile.
- Full generated TypeScript database types. Current service queries rely on Supabase's default client typing; generate types from the deployed schema and parameterize the client before expanding the project.
- Submission throttling, account abuse prevention, and operational monitoring. Latest-per-account crowd aggregation is not a rate limiter.
- Account deletion/export, retention rules, moderation audit history, and publication withdrawal.
- Venue catalog editing tools and provenance for real venue data.
- Proximity search, geographic indexes, push notifications, image storage, and Realtime subscriptions.
- Additional offline caching and realtime updates; catalog reads currently refresh on demand/foreground.

The initial SQL deliberately restricts access, protects server timestamps through column-level grants, and keeps moderators outside user-editable profiles. Hosted read checks, the two SQL access scripts and the impression API write check passed on 2026-11-22; remaining API/device scenarios still need their own checks.
