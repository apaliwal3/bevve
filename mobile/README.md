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

Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_KEY` to the existing project URL and **publishable** key.
The local workspace is already configured. Restart Expo after changing env files.
Never copy `TEST_EMAIL`, `TEST_PASSWORD`, secret keys or database passwords into
mobile configuration. With no valid public configuration, demo browsing still
works and sign-in reports that it is unavailable.

Login and Signup call Supabase Auth. When confirmation is enabled, Signup asks
the user to confirm the email, then return to Sign In. An immediate session goes
to Profile, where the account panel reads the signed-in user's database profile.
This initial step does not use a mobile email-confirmation redirect callback.

Native AsyncStorage persists the Supabase session; passwords remain transient.
Token refresh follows the app foreground lifecycle. The web/SSR adapter uses
memory only. Profile's **Sign Out** clears this device's session; other devices
stay signed in. Changing accounts also resets demo contribution/comparison state.
The app interface is English-only and ignores old saved language preferences.

Signed-in venue screens use the Supabase catalog and persist impressions.
Signed-out screens keep the original fictional demo. Guest submissions are never
uploaded or merged into a real account. See the connected catalog section below.

Manual device checks: sign in with a confirmed test account, reload the app and
verify restoration; confirm Profile's account name/email; sign out and check that
account details/demo state clear. Check invalid credentials, offline requests,
email-confirmation signup, rapid double submission, and a previously saved Italian
preference (the interface must remain English).

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
**Save impression**. The modal confirms only a successful server response.
**Close** discards an unsaved impression draft; confirmed writes remain saved.
A failure keeps the selected draft and allows retry.
Profile shows one current impression per venue, including edits. Reload the app,
open the same venue/Profile and confirm the saved answer remains. Sign out/in
or use a second device to verify account persistence. A different account must
not see the first account's private saved answers.

Loading and failures have explicit states, with refresh/retry controls and no
fallback to guest fixtures. Public summaries and exact-serving EUR prices are
read from the database. Real venues use eligible community aggregates; sample
venues never display purported real community percentages. Distances remain
unavailable until real location support exists. All/Cheap/Quiet/Popular filters
use catalog metadata and reported summaries.

Authenticated `+` opens the impression editor and personal comparisons. Apply the
new `003_personal_comparisons.sql` migration and run
`supabase/tests/personal-comparisons.sql` in SQL Editor to enable retry-safe
comparison writes; hosted application/verification is pending. Do not rerun 001
or 002 on the existing project.

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
positions without raw Elo. Profile shows confirmed comparison counts and links
to Rankings. Language/incident writes remain guest-demo-only. Price comparison
remains read-only; price submissions use a separate optional form in the venue's
`+` overlay. Guest activity is never merged into an account.

Account crowd reports, bathroom reviews and drink prices require the new
`004_venue_contributions.sql` migration, followed by
`supabase/tests/venue-contributions.sql` in SQL Editor. Apply 003 first if still
unapplied; do not rerun 001/002. Migration 004 is locally tested; hosted
application/API checks are pending.

The same inline **Report crowd**, **Rate bathrooms** and **Update drink prices**
cards appear after the account comparison section, once an impression is saved.
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

After deploying 004, check each form with a successful save, failed connection,
retry, rapid double tap, closing/reopening and a full app reload. Edit a bathroom
review and confirm its identity/count stays unchanged. Test legacy null category
prefills, two database servings of the same drink name, comma/point decimals,
empty catalogs and another account's history. Verify updated public summaries,
the crowd contributor threshold, Profile history and unchanged ranking positions.
Physical-device and hosted contribution API verification are pending.

After deploying 003, manually verify rapid repeated choice taps, retry after a
lost response, skip one/all, closing/reopening, navigation from Rankings back to
Rankings, app restart and account switching. Confirm choices persist and batches
reset on restart, and that editing an impression adds no vote. The app remains
English-only. Physical-device and hosted comparison API verification are pending.

Manual device checks: save all three choices, edit one venue, reload, sign out/in,
verify Profile counts once, cancel a draft, retry a failed network save and check
that rapid taps write once. Check an empty catalog, missing metadata, deleted or
invalid venue links, foreground refresh, account switching and direct Profile/
Bar Details/price links. Run the guest demo flow separately to verify it remains
unchanged. The following older manual journeys describe **guest demo mode**.

## Validation

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

## Guest demo session and English interface

- UUID-based fictional venues and a structured drink catalog are in `src/fixtures/`.
  Prices use integer EUR cents internally.
- Impressions, crowd reports, bathroom reviews, prices, language suggestions, private
  incident submissions and personal comparisons are shared in memory. Saved
  activity survives navigation, but resets on full reload or account changes.
- Form drafts are local to their screen or overlay. Closing a form may discard
  unsaved input. Returning to Welcome does not sign out or clear saved activity.
- English is the only interface language. There is no language selector and old
  device language preferences are ignored. Native AsyncStorage now persists the
  Supabase session, not demo reports or ranking history.
- Venue spoken-language suggestions are separate from the English interface and
  remain pending. Private incident reports are demo-only and are never published.
- Crowd classification needs three distinct recent contributors. This demo uses
  one contributor; repeated submissions cannot establish a live consensus.
- The `+` journey saves an impression, offers up to three distinct comparisons
  (none for the first experienced venue), then reveals the five optional forms.
  Skip one or all comparisons without creating votes. Reopening can resume a
  pending comparison flow; editing an impression does not automatically repeat it.
- Impression choices use one row of muted green, yellow and pink 56-point circles
  with wrapping EN/IT labels, check/minus/X symbols and a selected outline/badge.
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
- Explore, Rankings and Profile are the three persistent tabs. Tab changes keep
  the bottom bar mounted and disable scene animations. Rankings and Profile lead
  to Explore and a bar's `+` action to add impressions or resume comparisons.
- Bathroom categories and crowd reports retain their separate five-point scales.

The pure community-opinion helper supports genuine data: each distinct
user's latest eligible impression counts once, and `liked / total * 100` includes
fine and disliked in the denominator. There is no minimum opinion threshold.
Real zero opinions displays **No opinions yet**; any positive count displays a
rounded liked percentage and the distinct opinion count, including 0% or 100%
for one opinion. Demo impressions and retired star fixtures are excluded. The
guest demo has no real multi-user source, so it displays availability rather
than a fabricated percentage or a measured-zero claim. Signed-in real venues use
the database aggregate; sample venues remain excluded.

### Physical iPhone checks for Stage 9C-1

These are manual checks, separate from Node component-prop tests and iOS export:

1. In Explore and Bar Details, confirm there is no overall bar star score and
   that community opinions are unavailable in the demo. Bathroom stars remain.
2. Save an impression via `+`, skip or complete the bounded comparisons, and
   confirm the same five optional forms and their Cancel behavior still work.
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
src/app/(tabs)/       Explore, Rankings and Profile tabs
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
4. Reach Bar Details from each of the three tabs. Open Compare Drink Prices,
   choose a drink, open another bar and return through prices and the original
   bar. Confirm the selected drink, source venue and originating tab survive.
5. Use the current Expo Go development URL from the terminal, retaining its
   scheme and host but replacing the path after `/--/` with `compare`. Open it
   both after a full reload and with the demo already open: it must land on
   Rankings, with three tabs and no Compare screen on Back. Repeat with
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
   including bathroom stars and crowd scores. Check three tabs and Compare Drink
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
