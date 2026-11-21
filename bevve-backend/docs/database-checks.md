# Database integration checks

Run these against a disposable Supabase project after applying the migration and seeds. They have not been executed as part of generating this starter.

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
