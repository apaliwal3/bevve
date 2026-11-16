# bevve design reference

Approved Figma Make React/Vite prototype export used as the visual reference for
the native application in [mobile/](../../mobile/README.md).

- `App.tsx` contains the reference screens and interactions.
- `index.css` defines the palette, typography, spacing and animations.
- `main.tsx` and `package.json` retain the original web entry point and tooling
  metadata.

Treat the design source as read-only during native frontend work. The native app
uses React Native components and Expo Router rather than importing this web UI.

This checkout is a reference snapshot, not a complete standalone Vite setup:
it has no `index.html` or Vite configuration, and no running preview server is
implied. Use the mobile README for development and validation commands.
