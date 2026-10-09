# Emberhall branding

The displayed game name is **Emberhall**, including every translation, the
guide, recovery screens, desktop metadata, promotional site and invitation page.

Approved revision 4 artwork supplies the transparent wordmark (`logo.png`,
`logobig.png` and the small legacy `logo_.png`), flame-and-sword emblem
(`icon.png`, `icon.ico`, `icon.icns`, `favicon.ico`) and promotional thumbnail.
Use the wordmark where it can be read comfortably; use the emblem in the navbar
and native app icons. The title and session screens share revision 4's text-free
autumn arena background (`title/title.png`). Keep in-match artwork unchanged.

## Compatibility names

- Electron still stores profiles in the existing `client` directory below the
  OS application-data directory. This preserves local identity, preferences and
  pending gifts. Set the displayed Electron app name separately.
- `build.productName` is Emberhall; `build.executableName` stays Legion so Steam
  launch settings, Itch manifests and the established local build path keep
  working. The macOS bundle remains `Legion.app` with Emberhall display metadata.
- Keep `com.legion.game`, the `app://legion/` origin, `legion://` deep links,
  stored preference keys, service domains, Firebase project, Steam authentication
  identity and telemetry release identifiers. These names are integration or
  persistence contracts, not visible branding.
- The website remains on its existing `play-legion.io` domain until a separate
  domain migration. Itch links use `dikaryon.itch.io/emberhall` and the current
  trailer is `UYA7ADeMO9E` on Dikaryon's YouTube channel.

Any future rename of these compatibility identifiers needs its own migration
and packaged-app verification. Do not globally replace lowercase `legion`.
