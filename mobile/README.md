# bevve mobile

Native nightlife discovery demo built with Expo SDK 58, React Native, TypeScript
and Expo Router. The interface follows the approved bevve Figma Make reference.
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
4. Choose **Explore demo** on Welcome. Login and Signup are UI demonstrations;
   they do not authenticate users or create accounts.

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

## Validation

Run from `mobile/` after installing the locked dependencies:

```sh
# TypeScript
node node_modules/typescript/bin/tsc --noEmit --incremental false

# All mobile tests
node --experimental-strip-types --test tests/*.test.mjs

# iOS JavaScript/assets export; does not build or sign an installable app
node node_modules/expo/bin/cli export --platform ios --output-dir .expo/ios-export

# Resolve and inspect public Expo configuration
node node_modules/expo/bin/cli config --type public
```

Tests use Node's built-in test runner. They cover state, selectors, comparison
logic, validation, localization, mocked language storage and selected component
styles. They do not replace physical iPhone checks for rendering, keyboard
behavior, accessibility or native storage.

ESLint is not configured. The existing lint command enters Expo's setup flow;
it is not a ready-to-run code-quality check.

## Demo session and languages

- UUID-based fictional venues and a structured drink catalog are in `src/fixtures/`.
  Prices use integer EUR cents internally.
- Ratings, crowd reports, bathroom reviews, prices, language suggestions, private
  incident submissions and personal comparisons are shared in memory. Saved
  activity survives navigation and language switching, but resets on full reload.
- Form drafts are local to their screen or overlay. Closing a form may discard
  unsaved input. Returning to Welcome does not sign out or clear saved activity.
- English is the default. Select **English** or **Italiano** in Profile to change
  the interface immediately.
- Native AsyncStorage stores only the language preference, so it survives reloads.
  It does not store passwords, reports or ranking history. The web adapter keeps
  the language only in memory.
- Venue spoken-language suggestions are separate from the interface setting and
  remain pending. Private incident reports are demo-only and are never published.
- Crowd classification needs three distinct recent contributors. This demo uses
  one contributor; repeated submissions cannot establish a live consensus.
- Community overall stars, bathroom categories and personal rankings are
  independent. Elo is internal; rankings display ordinal positions.

The [localization guide](src/localization/README.md) explains dictionary updates,
formatting and persistence. The [asset inventory](assets/README.md) documents
bundled assets and the remaining app-icon requirements.

## Source organization

```text
src/app/              Routes and root provider layout
src/components/       Reusable native components and bottom navigation
src/constants/        bevve colors, typography and spacing
src/features/         Screens, state providers, reducers and selectors
src/fixtures/         Mock venues and catalog data
src/localization/     English/Italian dictionaries, persistence and formatting
src/types/            Shared venue presentation types
tests/                Node-based mobile tests
assets/               Bundled fonts, imagery and platform icon placeholders
```

The main routes are `/`, `/login`, `/signup`, `/explore`, `/compare`, `/rankings`,
`/profile`, `/bars/[barId]` and `/prices`. Contribution forms stay inside Bar
Details rather than navigating to separate pages.

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
