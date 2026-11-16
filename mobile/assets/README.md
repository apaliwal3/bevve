# bevve reference assets

- `images/welcome-nightlife.jpg`: bundled copy of the Unsplash photo used by the approved Figma Welcome screen, https://images.unsplash.com/photo-1791485910633-65eb38133d34 (1200px, quality 85).
- `fonts/DMSans-*.ttf` and `fonts/Manrope-*.ttf`: static faces from https://github.com/expo/google-fonts/tree/master/font-packages, matching the reference typography. The SIL Open Font Licenses are included beside the font files.

These assets load locally through the already installed `expo-image` and `expo-font` packages. The Welcome screen does not require an external image or font request.

Venue photographs are remote URLs in `src/fixtures/venues.ts` and require network
access unless cached. They depict fictional demo venues rather than verified
real-world listings.

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
