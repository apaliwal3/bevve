# bevve mobile

Native nightlife discovery demo built with Expo SDK 58, React Native, TypeScript
and Expo Router. The interface uses bevve's approved dark navy and purple design.
See the [repository README](../README.md) for features and backend boundaries.

## Prerequisites

- Node.js 24.3 or newer within 24.x, or Node.js 26.x, with npm. These versions
  satisfy the installed Expo and React Native engine requirements.
- Expo Go on your iPhone, compatible with Expo SDK 58.
- A computer running the development server. LAN mode requires the phone to
  reach that computer over the local network; tunnel mode requires internet.

The demo needs no Supabase credentials, backend server or authenticated account.

## Setup and run on iPhone

From the repository root:

```sh
cd mobile
npm ci
npm start -- --go
```

1. Keep the terminal and development server running.
2. Put the computer and iPhone on the same Wi-Fi network for LAN mode.
3. Scan the terminal QR code with the iPhone Camera and open the link in Expo Go.
   Allow local network access if iOS requests it.
4. Choose **Explore demo** while signed out for fictional fixtures, or use
   **Sign In** / **Create Account** for the connected catalog and saved impressions.

### Network troubleshooting

If the phone cannot reach the LAN server, stop it with Ctrl+C and run from
`mobile/`:

```sh
npm start -- --go --tunnel
```

Scan the new QR code. Tunnel addresses can change, so reopen the current link
rather than an old saved address. Expo may request optional tunnel tooling if
it is unavailable; it is separate from the mobile app's runtime dependencies.

To clear a stale Metro cache:

```sh
npm start -- --go --clear
```

## Supabase authentication

Signed-in users can open **Profile → Change Password**, enter their current
password, a new password of at least six characters and a matching confirmation.
The app verifies the current password and updates Supabase Auth through the same
shared operation as the backend auth service. Loading, policy/network errors and
success are shown in the form. Password drafts stay in screen memory and clear
on success, route blur and account change. Demo profiles see a sign-in message
when opening Change Password and cannot submit password updates.
This profile flow requires the current password. Forgotten passwords use the
email recovery flow below. No database migration or new environment variable is required.
Local component and mocked SDK checks cover the flow; native-device and hosted
password-change checks remain manual.

**Forgotten passwords:** both Sign Up and Sign In offer **Forgot password?**.
`/forgot-password` sends a Supabase recovery email and always shows the same
confirmation regardless of account existence. The email opens `/recover-password`,
which verifies the link's session before accepting a new password and confirmation.
It never asks for the old password. Expired/invalid links offer a fresh request.
Cold and warm app links are handled; recovery stays active across the account
session change, and auth screens do not redirect it to Explore prematurely.
Callback credentials are read outside router params and the callback route is
replaced to remove them from browser history. Drafts clear on blur/success/account change.

In **Supabase → Authentication → URL Configuration → Redirect URLs**, allow
`mobile://recover-password` for installed/development builds (the existing app
scheme is `mobile`). For web, allow `https://YOUR_APP_HOST/recover-password`, plus
the exact localhost callback when testing locally. Expo Go uses a callback such
as `exp://YOUR_LAN_IP:8081/--/recover-password`; allow that address for development
and update it when the dev host changes. The request uses `Linking.createURL` to
select the platform URL. Keep the recovery email template's `{{ .ConfirmationURL }}`
link so Supabase can verify the email token and honor the callback. No custom email
template or additional app dependency is required.

Local SDK/component/store tests cover request payloads, link verification, expired
links, account changes, validation and duplicate taps. Redirect allowlist changes,
real email delivery and installed-app/browser round trips remain manual; no hosted
auth settings or real account passwords were changed during implementation.

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_KEY` to the existing project URL and **publishable** key.
Use the project base URL (`https://YOUR_PROJECT_REF.supabase.co`), without
`/rest/v1` or another service path; the SDK appends those paths itself.
The local workspace is already configured. Restart Expo after changing env files.
Never copy `TEST_EMAIL`, `TEST_PASSWORD`, secret keys or database passwords into
mobile configuration. With no valid public configuration, demo browsing still
works and sign-in reports that it is unavailable.

Login and Signup call Supabase Auth. When confirmation is enabled, Signup asks
the user to confirm the email, then return to Sign In. An immediate session goes
to Profile, where the header reads the signed-in user's database username.
This initial step does not use a mobile email-confirmation redirect callback.

Native AsyncStorage persists the Supabase session; passwords remain transient.
Token refresh follows the app foreground lifecycle. The web/SSR adapter uses
memory only. Profile's **Log Out** clears this device's session; other devices
stay signed in. Changing accounts also resets demo contribution/comparison state.
The interface is English-only and ignores old saved Italian preferences.

Signed-in venue screens use the Supabase catalog and persist impressions.
Signed-out screens keep the original fictional demo. Guest submissions are never
uploaded or merged into a real account. See the connected catalog section below.

Manual device checks: sign in with a confirmed test account, reload the app and
verify restoration; confirm Profile's actual username; sign out and check that
account details/demo state clear. Check invalid credentials, offline requests,
email-confirmation signup, rapid double submission, and a previously saved Italian
preference (the interface must remain English).

## Want to visit

Apply `bevve-backend/supabase/migrations/007_saved_bars.sql` after migrations
001–006 to enable account bookmarks. The bookmark on each bar image and in Bar
Details saves/removes that bar. Profile’s **Want to Try** statistic opens a dedicated saved-bars list
and provides removal controls. Saves persist across sign-in and devices, stay
private through row-level security, and remain saved after the user rates a bar.
Saving/removing does not submit impressions or comparison votes.

Buttons update after database confirmation. Failed writes retain the confirmed
state and offer **Retry**; retries preserve the original save date and do not
create duplicate entries. Saved bars refresh on foreground, periodically, and
with Profile's pull-to-refresh. Guest bookmarks are memory-only and clear when
switching into or out of an account; they are never merged into account data.
Run `supabase/tests/saved-bars.sql` in Supabase to verify owner isolation and
save/remove behavior; its fixtures roll back. Hosted deployment and device
verification must be completed separately from the local checks.

## Connected venue catalog and impressions

The existing project has migrations `001_backend.sql` and
`002_catalog_impressions.sql` applied. For a fresh project, apply both in order,
then the optional fictional seed. The second migration preserves existing rows
and adds optional area/city/vibe/photo/opening-hours metadata plus impressions.
Administrators can populate metadata in Supabase's `bars` table; missing fields
show unavailable states. The current seed contains three sample venues, which
are different from the four guest fixtures. No names or serving sizes are used
as database join keys.

Sign in, open Explore, select a venue, tap `+`, choose an impression and tap
**Save impression and continue**. The modal advances only after a successful server response,
then offers the demo’s bounded comparisons followed by five matching optional cards.
Fill in the cards you want and tap **Save and finish** once. Started sections must be
complete; collapsed cards keep their drafts. Failed saves remain open for retry,
and confirmed sections are not submitted again.
**Close** discards an unsaved impression draft; confirmed writes remain saved.
A failure keeps the selected draft and allows retry.
Profile shows one current impression per venue, including edits. Reload the app,
open the same venue/Profile and confirm the saved answer remains. Sign out/in
or use a second device to verify account persistence. A different account must
not see the first account's private saved answers.

Loading and failures have explicit states, with refresh/retry controls and no
fallback to guest fixtures. Public summaries and exact-serving EUR prices are
read from the database. Real venues use eligible community aggregates; sample
venues never display purported real community opinions. All/Cheap/Quiet/Popular
filters use catalog metadata and reported summaries. Nearby and real distances
use automatic foreground device location, as described below.

### Nearby and device location

Signed-in accounts automatically start foreground location when the app becomes
active, requesting permission if needed. The same location session stays active
across tabs and Explore filters, so **All** shows distances without visiting Nearby.
Nearby shows real database venues within 1 km, sorted by unrounded straight-line
distance, then name/ID for ties. Search still applies. Cards and venue details show
approximate metric distances from the same device fix. Sample venues (`is_demo`)
have unavailable real distances and are excluded from Nearby. Guest demo distances
and its fictional Nearby filter are unchanged; the demo never requests location.

`expo-location` is installed for SDK 58 using Expo's compatible dependency map.
Restart Expo after installing dependencies. Foreground location is included in
Expo Go; its permission dialog uses Expo Go's native configuration. Existing custom
development/release binaries need rebuilding to include the module and bevve's
permission wording. App configuration enables foreground permissions only, with
background location, foreground services, Always access and motion tracking disabled.

The account-scoped store obtains a balanced-accuracy reading every two minutes
while the app is active, releasing each native subscription after an acceptable
reading. Automatic polls keep the previous valid coordinates and do not trigger
Explore's pull-to-refresh animation. Only a manual pull shows that spinner.
Checks, timeouts, expired readings and temporary native failures recover silently
through the scheduled polls; they do not ask the user to refresh location.
Permission, disabled services and precision settings still have recovery controls.
Location stops and clears coordinates when backgrounded, and rechecks existing
permission on return. A denied request is not repeated on every foreground
transition; permission and settings actions remain available for recovery. Brief
inactive events from system permission dialogs do not cancel the request. There
is no stop-location button. Sign-out or account changes destroy local location
state; the next account session starts location automatically.
Coordinates are neither persisted nor sent to Supabase. Existing venue latitude/
longitude columns supply destination coordinates; no new migration is required.

An accepted reading must have valid coordinates, be less than two minutes and 20 seconds old,
and report accuracy within 500 m. The first acceptable fix has a 20-second timeout;
denied/blocked permission, disabled services, insufficient accuracy, stale fixes,
native failures and timeouts have explicit recovery states. Precise-location and
blocked-permission states provide settings access. Coarse/unknown readings never
supply invented distances. Silent polls retry failed acquisitions on the next two-minute tick. A previously
accepted point remains visible during refreshes and temporary failures, but expires
after two minutes and 20 seconds without a fresh acceptable update, allowing the
next scheduled acquisition to finish before clearing existing distances. Nearby
waits for an acceptable fix instead of claiming zero venues. Other filters remain usable.

Local tests exercise geographic boundaries, filtering/order, native adapter/provider
wiring, permission recovery, timers, cleanup, account isolation and UI states. Native
configuration introspection checks permission declarations without generating native
folders. Physical-device verification remains pending: test Allow Once/While Using,
denial, permanent blocking/settings return, approximate/precise access, services off,
indoors timeout, movement, stationary refresh, background/foreground, restart and
account switching. Confirm All shows real distances on first entry and after
visiting Nearby, with no stop-location control.
Use a real `is_demo = false` venue with correct coordinates; the fictional seed
venues are deliberately excluded. Check real devices in Expo Go and rebuilt custom
binaries, including permission text and larger text/safe-area behavior.

Authenticated `+` opens the impression editor and personal comparisons. The owner
confirmed migration `003_personal_comparisons.sql` was deployed through SQL Editor
on 2026-11-23. Hosted results for `supabase/tests/personal-comparisons.sql` and
actual comparison API/device verification have not been reported. Do not rerun
deployed migrations.

Save impressions for two venues, then tap **Start comparisons**. Batches offer at
most three distinct opponents from your saved database experience. Picking a
venue saves one private vote before updating rankings. Skip one/all creates no
vote, and editing an impression never affects Elo. New batches require an
explicit **Compare this bar again** action. Reopening a venue resumes its current
prompt without creating a new batch or vote. Closing a modal does not cancel an
in-flight save. A failed/uncertain save retains the original choice and request
ID; retry that choice or refresh comparison history to confirm it. Changing the
choice/skipping is disabled until that uncertain write is confirmed.

History restores across app restarts and sessions; unfinished batches are held
only in the current session and reset on restart/sign-out. Rankings show ordinal
positions and confirmed comparison counts without raw Elo. Profile focuses on
experienced venues and the four safe contribution categories. Private incident writes use the account safety flow below. Price comparison
remains read-only; price submissions use a separate optional form in the venue's
`+` overlay. Guest activity is never merged into an account.

Account crowd reports, bathroom reviews and drink prices use migration
`004_venue_contributions.sql`, confirmed deployed by the owner through SQL Editor
on 2026-11-23. Local tests pass; hosted results for
`supabase/tests/venue-contributions.sql` and actual contribution API/device checks
have not been reported. Do not rerun migrations 001–004.

The same inline **Report crowd**, **Rate bathrooms** and **Update drink prices**
cards appear after the account comparison step, once an impression is saved.
Crowd, bathroom, price, language and incident forms share a final **Save and finish**
button. Closing before that final save discards unsaved optional form edits; private
incident drafts and unconfirmed requests remain available to retry.
All are optional. Crowd submissions append history, prefill the latest own level,
and count only the latest report per contributor in the 45-minute window; at
least three contributors are required for a classification. Bathroom forms
prefill the owner's existing review, keeping legacy unknown fields unselected.
All three ratings are required to save an edit, which replaces the current
review. Prices use the database catalog and exact serving UUID, prefill the
latest reported venue price, and accept EUR amounts from €0.50 to €100. Each
correction appends a new observation.

Profile restores all crowd reports, one current bathroom review per venue and
the user's EUR price history. Loading failures show retry controls, without
showing empty success states or guest fixtures. Successful writes refresh venue
summaries, Explore filters, and read-only price comparison. Rankings are unchanged.
Pending/uncertain writes lock their submitted details and retain the request
while navigating or reopening the form. Retry reuses the original request for
append-only crowd/price writes; bathroom retry upserts the same review. Restart
or sign-out clears local pending requests; confirmed server history restores.

With 004 deployed, check each form with a successful save, failed connection,
retry, rapid double tap, closing/reopening and a full app reload. Edit a bathroom
review and confirm its identity/count stays unchanged. Test legacy null category
prefills, two database servings of the same drink name, comma/point decimals,
empty catalogs and another account's history. Verify updated public summaries,
the crowd contributor threshold, Profile history and unchanged ranking positions.
Physical-device and hosted contribution API verification are pending.

### Account spoken-language suggestions

Migration `005_language_suggestions.sql` adds account submissions, owned history
and a moderator review queue. The owner confirmed that the language feature works
and the hosted [rollback check](../bevve-backend/supabase/tests/language-suggestions.sql)
passed on 2026-11-23. Migrations 001–005 are deployed and must not be rerun. Detailed
API and physical-device verification outcomes have not been recorded.

After saving an impression, open **Spoken languages** in the venue's `+` editor.
Select any number of languages, then use **Save and finish**. Confirmed suggestions
appear immediately on your bar page with **Not verified** beside each language;
the empty-language message appears only when there are no associated or submitted
languages. Guest submissions appear in the demo session too.
Approved associations come only from the database. Account suggestions remain
visible to their author and moderators, separate from approved public associations.
Multi-language saves retain confirmed choices and retry the same request ID for an
uncertain write before continuing with the remaining choices. Settings shows
all owned Pending, Approved and Rejected rows; they do not enter update counts or
rankings. Pending operations reset on restart/sign-out; confirmed history restores.
Language loading/retry states are independent of crowd, bathroom and price forms.

Accounts in `private.moderators` see a review queue in Settings. Approval atomically
adds the language without replacing existing evidence; rejection publishes nothing.
An uncertain review retains its selected decision for retry. Reviews and refreshed
history invalidate the public catalog, including when an older read is in flight.
Moderator own-history reads still explicitly filter by owner. Venue spoken languages remain independent of the English-only interface.

Remaining device checks include submission, rapid taps, lost-response retry, close/reopen,
restart and account switching on a device. With two accounts and a moderator, check
private histories, approval/rejection, queue refresh and approved-language display
on another device. Guest suggestions must stay local and never enter account history.

### Account private incidents and published safety information

The owner confirmed [migration 006](../bevve-backend/supabase/migrations/006_account_safety.sql)
was deployed and verified on 2026-11-23. Do not rerun migrations 001–006. The complete
[rollback SQL check](../bevve-backend/supabase/tests/account-safety.sql) may be rerun.
Detailed API/device scenarios were not enumerated in the confirmation.

Open a venue's `+` action and **Optional private incident report**; saving an
impression is optional for reporting. Category and private description are required,
with an optional valid local calendar date. Drafts, uncertain submissions and
moderator summary drafts stay scoped to the account for this app session. Closing
the form preserves its draft; a confirmed submission clears it. Retries reuse the
original request UUID and details. Restart/sign-out clears pending work; confirmed
private history restores from Supabase. Reports never enter rankings or update counts.

Settings shows **My private incident reports** with Pending/Approved/Rejected status,
submission/review times and private details. Reads explicitly filter `reporter_id`,
including for moderators. Accounts in the existing `private.moderators` allowlist
see a separate pending review queue. Its public-summary field starts blank, persists
on navigation, and is never prefilled from a private description or reporter identity.
Approval requires a separate summary; rejection sends no public text. Uncertain
reviews lock the decision and exact summary for retry. A repeated confirmed decision
does not create another publication; changing that decision/summary fails.

Venue details and the report form read only `published_incidents` through a
dedicated public projection. It has no private report/reporter IDs or original
description. Loading, unavailable reads and genuine empty results remain distinct;
failed refreshes retain the last loaded summaries. Approval queues another public
read if an older one is in flight. Foreground/periodic/manual refresh also updates
history, access and viewed venues. Review is not independent verification and
missing information does not guarantee safety. Guest incidents remain in memory.

For detailed device coverage, use accounts A/B and moderator M: submit as A,
confirm B cannot read the private report, inspect M's queue and separate own history,
approve with a public summary, then verify A's status and both clients' venue details.
Repeat with rejection and lost-response retries. Check date/draft restoration,
rapid taps, closing/reopening, restart/sign-out, account isolation, empty/error states,
and that private text/identity is absent from the public view. Record these individual
outcomes separately from the confirmed hosted deployment/verification.

With 003 deployed, manually verify rapid repeated choice taps, retry after a
lost response, skip one/all, closing/reopening, navigation from Rankings back to
Rankings, app restart and account switching. Confirm choices persist and batches
reset on restart, and that editing an impression adds no vote. Physical-device and hosted comparison API verification are pending.

Manual device checks: save all three choices, edit one venue, reload, sign out/in,
verify Profile counts once, cancel a draft, retry a failed network save and check
that rapid taps write once. Check an empty catalog, missing metadata, deleted or
invalid venue links, foreground refresh, account switching and direct Profile/
Bar Details/price links. Run the guest demo flow separately to verify it remains
unchanged. The following older manual journeys describe **guest demo mode**.

## Validation

Explore opens with a map in the top half and the existing bar cards below it.
Scrolling the cards moves the map offscreen, including for short or empty results;
the floating **Show map** button returns to the split view. Search and filters
update both cards and markers. Tap a marker, then **View Bar Details**, to open it.
Guest markers are illustrative neighborhood locations; account markers use the
catalog coordinates and label sample venues. No additional location access is
requested by the map.

The map uses Leaflet 1.9.4 and OpenStreetMap tiles over HTTPS, with attribution.
It requires a network connection and displays a message if map assets cannot
load. Web uses a sandboxed iframe; iOS and Android use `react-native-webview`
14.0.1 (Expo SDK 58 compatible). Existing development builds must be rebuilt to
include WebView; Expo Go includes it. Map rendering and touch gestures still
need a physical-device check.

Run from `mobile/` after installing the locked dependencies:

```sh
# TypeScript
node node_modules/typescript/bin/tsc --noEmit --incremental false

# All mobile tests
node --experimental-strip-types --test tests/*.test.mjs

# ESLint (report findings without applying fixes)
npm run lint

# iOS JavaScript/assets export; does not build or sign an installable app
node node_modules/expo/bin/cli export --platform ios --output-dir .expo/ios-export

# Resolve and inspect public Expo configuration
node node_modules/expo/bin/cli config --type public
```

Tests use Node's built-in test runner. They cover state, selectors, comparison
logic, validation, localization, mocked language storage and selected component
styles. They do not replace physical iPhone checks for rendering, keyboard
behavior, accessibility or native storage.

ESLint uses the official `eslint-config-expo/flat` preset in `eslint.config.js`.
The lint command checks mobile source, tests and scripts without applying fixes.
Generated native folders, Expo caches, build outputs and dependencies are ignored.
Backend code is outside the mobile lint scope.

## Guest demo session and interface language

- UUID-based fictional venues and a structured drink catalog are in `src/fixtures/`.
  Prices use integer EUR cents internally.
- Impressions, crowd reports, bathroom reviews, prices, language suggestions, private
  incident submissions and personal comparisons are shared in memory. Saved
  activity survives navigation, but resets on full reload or account changes.
- Form drafts are local to their screen or overlay. Closing a form may discard
  unsaved input. Returning to Welcome does not sign out or clear saved activity.
- The interface is English-only. Settings has no language switch and old
  device language preferences are ignored. Native AsyncStorage persists Supabase
  sessions, never demo reports or ranking history.
- Venue spoken-language suggestions are separate from the interface language and
  remain pending in the guest demo. Account suggestions use the review flow above.
  Guest private incident reports are demo-only and are never published. Account
  reports use the separate private-review/public-summary flow above.
- Crowd classification needs three distinct recent contributors. This demo uses
  one contributor; repeated submissions cannot establish a live consensus.
- The `+` journey saves an impression, offers up to three distinct comparisons
  (none for the first experienced venue), then reveals the five optional forms. Each card retains its draft when collapsed;
  **Save and finish** submits all completed edits together.
  Skip one or all comparisons without creating votes. Reopening can resume a
  pending comparison flow; editing an impression does not automatically repeat it.
- Impression choices use one row of muted green, yellow and pink 56-point circles
  with wrapping English labels, check/minus/X symbols and a selected outline/badge.
  The long introductory paragraph is removed; the modal still scrolls at larger
  text sizes and retains its top-down animation and reduced-motion behavior.
- A saved, unchanged impression offers **Resume comparisons** for pending work,
  or **Compare this bar again** when a new batch has eligible opponents. These
  actions do not resave the impression. **Continue to contributions** preserves
  pending work and creates no votes. Changed selections keep the existing Save
  action. New batches reuse the bounded controller, including previous opponents
  when appropriate; no opponents produces an honest message instead of a dead action.
- Overall bar stars and their fixture baselines have been removed. Explore and
  Bar Details say community opinions are unavailable in the demo. Your saved
  impression is separate, and Profile counts one current impression per venue.
- Impressions do not change Elo. Only explicit comparison choices affect personal
  rankings, which display ordinal positions.
- Explore, Drink prices, Rankings and Profile are the four persistent tabs. Tab changes keep
  the bottom bar mounted and disable scene animations. Rankings leads
  to Explore and a bar's `+` action; Profile presents saved activity.
- Drink prices compares the selected catalog drink across venues. Explore has no
  price-comparison footer. The tab shares its screen with `/prices`, which retains
  contextual links from Bar Details and their Back navigation.
- Bathroom categories and crowd reports retain their separate five-point scales.

The community-opinion summary counts each distinct user's latest eligible
impression once. It displays **Mostly liked**, **Mostly okay**, or **Mostly
disliked** for the category with the most opinions, and **Mixed opinions** when
the leading categories tie. The existing opinion count remains visible; there
is no percentage or distribution bar. There is no minimum opinion threshold.
Real zero opinions displays **No opinions yet**. Demo impressions and retired
star fixtures are excluded. The guest demo has no real multi-user source, so it
displays availability rather than an invented sentiment or measured-zero claim.
Signed-in real venues use the database category counts; sample venues remain
excluded.

### Physical iPhone checks for Stage 9C-1

These are manual checks, separate from Node component-prop tests and iOS export:

1. In Explore and Bar Details, confirm there is no overall bar star score and
   that community opinions are unavailable in the demo. Bathroom stars remain.
2. Save an impression via `+`, skip or complete the bounded comparisons, and
   fill in the optional cards and use **Save and finish**. Check that incomplete
   sections block saving and collapsed cards retain their drafts.
3. Dismiss and reopen the overlay, navigate away and return.
   Confirm saved impressions and pending comparisons survive in this app session.
4. Edit an impression. Confirm **Your impression** and Profile update, Profile
   still counts that venue once, and comparison history/ranking positions do not
   change merely from editing. Community statistics must remain unavailable.
5. Check bathroom category selection/validation, crowd reports, ordinal Rankings
   and read-only Compare Drink Prices.
6. Check English with VoiceOver and larger text, including opinion and
   impression labels, safe areas and card wrapping. A full reload resets demo
   activity while retaining a valid native authentication session.

The [localization guide](src/localization/README.md) explains dictionary updates,
formatting and persistence. The [asset inventory](assets/README.md) documents
bundled assets and the remaining app-icon requirements.

## Source organization

```text
src/app/              Routes and root provider layout
src/app/(tabs)/       Explore, Drink prices, Rankings and Profile tabs
src/components/       Reusable native components and bottom navigation
src/constants/        bevve colors, typography and spacing
src/features/         Screens, state providers, reducers and selectors
src/fixtures/         Mock venues and catalog data
src/localization/     English UI copy and formatting helpers
src/types/            Shared venue presentation types
tests/                Node-based mobile tests
assets/               Bundled fonts, imagery and platform icon placeholders
```

The main routes are `/`, `/login`, `/signup`, `/explore`, `/rankings`, `/profile`,
`/bars/[barId]` and `/prices`. Contribution forms stay inside Bar Details rather
than navigating to separate pages.

`/compare` remains only as a compatibility redirect outside the tab group. Its
focus handler calls `dismissTo('/rankings')`: an existing tab stack is reused,
and a direct link replaces the compatibility route instead of keeping it as a
Back destination. Legacy Bar Details links with `returnTo=compare` dismiss to
Rankings too. Current Explore, Rankings, Profile and price-comparison return
contexts are unchanged. Shared comparison state, pending overlay flows and Elo
still belong to the same root provider.

### Physical iPhone checks for Stage 9C-2

1. Start Expo Go with `npm start -- --go`. Open the demo and verify exactly
   **Explore, Rankings, Profile**. Tap each tab repeatedly: the bar stays still,
   the active indicator follows selection, and no screen slides horizontally.
2. From empty and populated Rankings and Profile, tap **Explore bars**. Open a
   bar and tap `+`. Confirm the first impression offers no comparison, the next
   offers one, and a fourth experienced bar offers at most three opponents.
3. Dismiss a pending comparison, switch tabs, then reopen that bar
   and tap **Resume comparisons**. Test Skip one and Skip remaining;
   only choosing a winner changes history and ordinal Rankings. Rapidly double
   tap a choice and confirm only one comparison is saved.
4. Reach Bar Details from each of the four tabs. Open Compare Drink Prices,
   choose a drink, open another bar and return through prices and the original
   bar. Confirm the selected drink, source venue and originating tab survive.
5. Use the current Expo Go development URL from the terminal, retaining its
   scheme and host but replacing the path after `/--/` with `compare`. Open it
   both after a full reload and with the demo already open: it must land on
   Rankings, with four tabs and no legacy Compare screen on Back. Repeat with
   `bars/<valid fixture UUID>?returnTo=compare`; Back must go to Rankings.
6. Repeat tab, Explore-button and contextual Back checks in English. Check
   VoiceOver tab labels/selection, larger text and bottom safe-area spacing.

### Physical iPhone checks for Stage 9D

These checks are separate from Node tests and iOS JavaScript export:

1. Start Expo Go with `npm start -- --go`. Reload to start a fresh demo session.
   Open Luna Rossa and tap `+`. Confirm all three circles share one row, labels
   sit beneath them, and tapping the circle or label adds an outline/check badge
   and selects exactly one value. Save an impression: no opponent means a clear
   message and the five optional cards, without a Compare action.
2. Open Basso Club, tap `+`, save **I liked it**, then **Skip remaining
   comparisons**. Close and reopen `+`: the saved choice is preselected and
   **Compare this bar again** and **Continue to contributions** are available.
   Reopening alone must leave the comparison count unchanged.
3. Choose **Continue to contributions**, close and reopen again, then choose
   **Compare this bar again**. A fresh comparison with Luna Rossa appears without
   another impression submission. Double tap a preference: only one vote should
   be counted. Reopen and compare again after completion; the earlier vote and
   ordinal Rankings must survive. Starting the new batch alone adds no vote.
4. Save impressions for Nottetempo and Violet Room. In a batch with multiple
   opponents, answer one comparison, dismiss, switch tabs and reopen.
   **Resume comparisons** must appear instead of Compare again, retaining the
   next prompt and count. **Continue to contributions** must keep that batch
   available for a later resume. Exercise both Skip controls; no batch repeats
   an opponent or exceeds three comparisons.
5. Check **Resume comparisons** and **Compare this bar again**. Check all three
   impression values and edit/save one without
   adding an activity count or an automatic comparison vote.
6. On the smallest available iPhone, test default and largest accessibility text
   sizes with VoiceOver. Labels must wrap without clipping or horizontal overflow;
   check radio labels/checked state, scrolling to actions, camera/home safe areas,
   normal top-down animation and Reduce Motion. Decorative symbols stay fixed
   size while labels follow Dynamic Type.
7. Confirm all five optional forms still validate, submit and Cancel as before,
   including bathroom stars and crowd scores. Check four tabs and Compare Drink
   Prices remain intact. Saved demo activity still resets on full reload.

## Application identity

`app.json` sets the visible app name to **bevve**. The npm package name, Expo slug
and URL scheme remain `mobile` to preserve existing tooling and project links.
Platform icon references still use the original starter assets pending approved
bevve artwork. No new cloud project, ownership or signing configuration is needed
for the Expo Go demo.

After an app-config change, restart the development server and reopen its current
QR code in Expo Go to refresh project metadata. This does not rename the installed
Expo Go application itself. Updating an installed development/standalone app's
native name or icon requires a new native build. See the
[Expo app-config reference](https://docs.expo.dev/versions/v58.0.0/config/app/).

## Profile redesign

Profile uses the shared theme, Manrope/DM Sans fonts and four persistent
primary tabs. Its header uses an honest **Demo profile** / **Your profile** name,
initials avatar, actual account username when loaded, and one demo-mode badge for
guests. First names, surnames and photos are not invented.

Exactly two clickable statistics lead to root-stack routes: `/places-been` counts
one current saved liked/fine/disliked impression per distinct venue; `/want-to-try`
shows the existing saved-bars list with real saved dates and removal controls.
The Want to Try count comes from confirmed bookmarks in SavedBarsProvider; loading
or failed initial reads show an unavailable count, with retry feedback. Bookmarks
remain independent of impressions and are kept after rating a venue. Merely
opening venues, comparison votes and optional contributions never add visits.
Places Been has photographs/fallbacks, neighborhoods, concise saved impressions
and venue links; impression submission dates are not presented as visit dates.

One FlatList owns the Profile header and chronological feed. It combines saved
impressions, crowd reports, bathroom reviews and drink-price observations from
the existing guest/session or signed-in providers. Impressions and bathroom edits
show the current editable record with its real update timestamp; crowd/price
history retains submissions. Reliable timestamps sort newest first, ties use
stable IDs, and invalid/missing timestamps are omitted and sorted last. Bathroom
scores retain their own /5 scale; no overall stars or raw Elo enter the feed.
Private incidents, pending language suggestions, moderation and comparisons stay
out of it. Account history/moderation tools remain separately accessible in
`/settings`; the underlying forms, models and stores are retained.

Activity opens `/bars/[barId]?returnTo=profile`; native Back returns to Profile
and direct links fall back there. Places Been uses `returnTo=places`, returning
to the list before Profile. Want to Try uses `returnTo=wants`, returning to
the saved list. Change Password, Want to Try and Settings use native
root-stack history with a Profile fallback, following the existing Bar Details
pattern. Primary tabs remain mounted; secondary screens follow existing full-screen
stack behavior. Price-comparison and Rankings origins remain intact.

### Profile backend compatibility audit

This audit inspected repository contracts, not the hosted dashboard:

- Migration 001 defines `profiles.id` (UUID auth-user PK), `username` (required
  trimmed length 1–40), `preferred_language` (`en`/`it`, default `en`), and
  `created_at` (server timestamp). No later migration adds identity fields.
- Backend `authService.getMyProfile()` reads the current row.
  `updateMyProfile(username, language)` writes only username/preferred_language.
  The existing mobile client reads username; no full profile-update adapter exists.
- Real Expo authentication is already connected: password sign-in/signup,
  confirmation handling, session restoration/refresh and local-device sign-out.
  A trigger creates the profile. Guest data is isolated and never uploaded.
- `profile_read` / `profile_edit` RLS restrict select/update to `auth.uid() = id`;
  authenticated column grants permit only username/preferred_language updates.
- First name, surname and avatar URL/object-key fields do not exist. There is no
  avatar bucket, upload service or Storage policy in the repository. Hosted
  configuration outside these contracts was not verified.
- Full editing requires an agreed names/avatar schema migration, validation and
  update grants; avatar Storage bucket/read/write/delete ownership rules, file
  type/size limits and replacement cleanup; and mobile profile read/update/upload
  contracts with loading, validation, failure and refresh handling. Username is
  currently free text, not a unique handle; a production handle policy needs an
  explicit contract if uniqueness/format is desired. Existing auth can be reused;
  password recovery remains separate existing work.

`/change-password` replaces the retired `/edit-profile` preview and opens the
working authenticated password form. `/reset-password` remains an alias to the
same screen. Profile has one Change Password action with the existing styling.
The form uses the shared secondary header, safe areas and native Back history
with a `/profile` fallback for direct links. Signed-in users supply their current
password, a new password and confirmation; demo users see a sign-in message.
Passwords are validated, the current password is verified and Supabase Auth saves
the update. Loading, error, retry and success states stay in the existing password
feature. Email-based forgotten-password recovery remains available from Sign Up
and Sign In. See the authentication setup above for callback configuration.

The top-right Settings control uses a gear. Settings has no app-language section,
selector or duplicate password action. Signed-in users see two compact,
expandable rows: **My language suggestions** and **My private incident reports**.
Opening a row reveals its existing history and role-gated moderation tools;
closing it only hides the content. Existing provider records, pending statuses,
submission/retry drafts and private/public boundaries are unchanged. Settings
never adds reports to public activity. Guests see a short sign-in availability
message, without account histories. Disclosures reset when the account changes.

English-only behavior is already enforced by the root `LanguageProvider` for UI
copy and number/date/currency formatters. Legacy saved Italian preferences are
ignored at startup; no migration or additional runtime change is required.
Italian dictionaries, translation helpers and the unused legacy language store
remain for compatibility. Database `preferred_language` remains `en`/`it` and is
not used by the running interface. Removing that legacy capability from storage
or backend contracts would be a separate cleanup; user-authored content and venue
spoken-language data remain unchanged.

**Log Out** awaits the existing `signOut()` (local-device Supabase session) and
returns to Welcome only on success; failures remain visible for retry. Guests get
**Return to Welcome**, which performs no auth call and retains demo activity for
the current app session. The interface remains English through both paths. A full reload
may clear guest activity, as before.

### Physical iPhone checks for the Profile redesign

These remain manual; Node component/state tests and JavaScript export do not
verify native layout, VoiceOver, gestures or real-device auth/network behavior.

1. From `mobile/`, run `npm start -- --go`. Use SDK-58-compatible Expo Go, put the
   iPhone and computer on the same Wi-Fi, scan the current terminal QR code, and
   choose **Explore demo**. Start with a full reload for empty demo state.
2. Open Profile: check honest demo identity, initials and a single demo badge,
   Places Been = 0, Want to Try = 0, two action buttons and the
   empty Activity state. Check exactly Explore, Drink prices, Rankings, Profile in the bottom
   bar, stationary while switching tabs.
3. Open each of Places Been, Want to Try, Change Password and Settings. Use both
   their Back button and iOS edge-swipe Back. Each must return to Profile. A fresh Want
   to Try list has no saved venues; Change Password shows its sign-in message in
   demo mode, with no password inputs. Test a direct link to each route with no previous history: the
   visible Back button must still reach Profile. Bookmark a bar in Explore and
   confirm Want to Try increases once, opens that bar, and returns to the list
   from Bar Details. Remove it from the list and check the count decreases. Save
   and rate a bar: the bookmark must remain and Places Been must count only the
   impression. Repeat with an unavailable venue and confirm removal still works.
4. In Explore open Luna Rossa → `+`, save Liked, skip any comparisons, finish
   contributions. Repeat with Fine at Basso Club and Disliked at Nottetempo.
   Profile/Places Been must show exactly three venues. Edit one impression:
   count remains three, saved label changes, and its activity moves by update
   time. Compare or contribute again without adding an impression: count stays
   three. Verify Rankings and community percentages are unchanged by edits.
5. Submit a crowd report, bathroom scores (e.g. 4/3/5) and a catalog drink price
   using the existing optional forms. Profile must show actual values and real
   submission/update times in descending order; only bathrooms use /5. No
   submission creates a visit timestamp. Submit a private incident and pending
   language suggestion: neither may appear in this feed. All five forms remain.
6. Tap each feed category → Bar Details → Back: return to Profile, retaining
   state. Places Been → venue → Back returns to Places Been → Profile. Also
   check Rankings → venue and Bar Details → Compare Drink Prices → another
   venue → Back, preserving the drink and original venue.
7. Check that the gear opens Settings with no App language section or language
   switch, and no duplicate password action. Guests see a short sign-in message. Reload an
   installation that previously saved Italian: the interface must remain English.
   Return to Welcome and enter the demo again; current-session activity survives.
8. Sign in with an existing test account. Account bookmarks require the existing
   migration 007 to be deployed; no migration or hosted change is performed here.
   Verify bookmark persistence after reload/sign-out and a failed-read retry.
    Check its actual username, honest
   initials avatar, database impressions/count and confirmed contribution
   history, sample-venue labels, pull-to-refresh and failure/retry states. Change
   Password must show the authenticated current/new/confirmation form. Check
   validation, incorrect-current-password errors and retry using a test account.
   In Settings, expand/collapse both account rows; check existing pending statuses,
   private report descriptions and venue navigation/Back. Existing moderators
   retain review access; ordinary users must see no review queue. Private
   reports and pending suggestions must never appear in the Profile feed. Log Out must return to Welcome and
   keep the interface in English; signing back in restores server data. Do not create a new
   account or change hosted configuration for this check.
9. On the smallest available iPhone and one with Dynamic Island, enable Settings
   → Accessibility → Display & Text Size → Larger Text → Larger Accessibility
   Sizes, then the largest size. Enable VoiceOver and repeat all actions. Check
   labels wrap, touch targets stay reachable, initials fit,
   the screen scrolls as one surface, the Profile bottom bar remains visible,
   and camera/home safe areas and native swipe Back work. Turn on Reduce Motion
   and repeat primary tab changes.
