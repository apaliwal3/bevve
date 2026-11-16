# bevve reference assets

## Fonts

`fonts/DMSans-*.ttf` and `fonts/Manrope-*.ttf` are the bundled faces used by the
native theme, originally sourced from the
[Expo Google Fonts packages](https://github.com/expo/google-fonts/tree/master/font-packages).
Their SIL Open Font License 1.1 notices are included in
[`DMSans-OFL.txt`](fonts/DMSans-OFL.txt) and [`Manrope-OFL.txt`](fonts/Manrope-OFL.txt).
Keep those notices with redistributed font files.

## Photographs and provenance

The following image sources are recorded for the current native app. Venue URLs
are used by [`venues.ts`](../src/fixtures/venues.ts); the bundled Welcome image
is loaded by [`welcome.ts`](../src/fixtures/welcome.ts).

- **Welcome — bundled:** `images/welcome-nightlife.jpg` (1200 × 1810 JPEG).
  Its recorded source is [Unsplash CDN image 1791485910633-65eb38133d34](https://images.unsplash.com/photo-1791485910633-65eb38133d34).
  The repository contains no photographer credit or original photo-page link;
  the bundled bytes have not been independently matched to that CDN source.
- **Luna Rossa — remote:** [Unsplash CDN image 1546847596-b6c8086514d0](https://images.unsplash.com/photo-1546847596-b6c8086514d0).
- **Basso Club — remote:** [Unsplash CDN image 1744928869793-3908b4649ad6](https://images.unsplash.com/photo-1744928869793-3908b4649ad6).
- **Nottetempo — remote:** [Unsplash CDN image 1707208097739-e3bdf439acb2](https://images.unsplash.com/photo-1707208097739-e3bdf439acb2).
- **Violet Room — remote:** [Unsplash CDN image 1764270720089-63e2a918b51f](https://images.unsplash.com/photo-1764270720089-63e2a918b51f).

**All five photographs: asset-specific provenance and redistribution rights
remain unverified.** The source trail records the URLs associated with the demo,
not the photographer, original publication page or license applicable to each
image. No creator identities or asset-specific license grants were confirmed.

The [standard Unsplash License](https://unsplash.com/license), checked on
16 November 2026, permits downloading, modifying and distributing covered images
for commercial and noncommercial use, subject to restrictions on unmodified
image sales and competing image collections. That general policy does not prove
that every URL above is covered. Before public distribution, record each original
photo page, photographer, applicable license and any required permissions.

These images remain provisional demo imagery.
Venue names and associations are fictional and do not identify the photographed
businesses or imply endorsement. Remote venue photographs need network access
unless cached. The Welcome image and fonts load locally through `expo-image`
and `expo-font`.

## Application branding

The in-app bevve wordmark is rendered by `src/components/logo.tsx` with bundled
fonts; it is not an exported app-icon asset.

The configured `images/icon.png`, `expo.icon/`, Android adaptive icons and favicon
contain starter artwork. They remain placeholders, not approved bevve branding.

An approved square 1024 × 1024 bevve PNG master with an opaque background is
needed for the base iOS app icon. Provide full-square artwork without baked-in
rounded corners. An approved Icon Composer `.icon` bundle is an alternative.
Android adaptive foreground/background and monochrome artwork, plus a web
favicon, are also needed to complete branding on those platforms.

When approved artwork is available, review all platform overrides in `app.json`:
`ios.icon` currently overrides the general `icon`, and Android uses its separate
adaptive-icon assets. See [Expo icon configuration](https://docs.expo.dev/versions/v58.0.0/config/app/#icon).
