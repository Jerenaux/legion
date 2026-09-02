# Desktop release and Steam promotion

Desktop releases are built by `.github/workflows/release-desktop.yml` on all three native runners. A `v*` tag creates signed Windows, notarized universal macOS, and Linux artifacts. Store uploads are manual workflow-dispatch options.

## Required GitHub configuration

Use the protected `desktop-release` environment.

Secrets:

- `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`: base64 Developer ID Application certificate and password.
- `APPLE_API_KEY`, `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`: App Store Connect API credentials for notarization.
- `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`: base64 Authenticode certificate and password.
- `BUTLER_API_KEY`: restricted Itch.io API key.
- `STEAM_USERNAME`: dedicated Steam build account.
- `STEAM_CONFIG_VDF`: base64 Steam Guard configuration for that account. No Steam password is passed on a command line.

Variables:

- `ITCH_TARGET`: Butler target without a channel, for example `dynetis-games/legion`.
- `STEAM_FIRST_DEPOT_ID`: first of three consecutive depots, ordered Windows, Linux, macOS.

The Steam app ID is `3729580`. Give the builder account only the permissions required to upload builds for that app.

## Release flow

1. Run local verification from `docs/desktop-release-checklist.md`.
2. Push a `v*` tag. CI must produce all three signed artifacts and pass each packaged smoke test.
3. Run **Build desktop releases** manually with `upload_steam=true` and an existing private beta branch such as `playtest`.
4. Install the private Steam branch on Windows, macOS, and Steam Deck/Linux. Test startup, platform authentication, matchmaking, a completed match, reconnect, controller input, fullscreen, and clean exit.
5. Promote the tested Build ID manually in Steamworks. The workflow never publishes to Steam's default branch.

For Itch.io, run the workflow with `publish_itch=true`. It validates `.itch.toml` with Butler and publishes the `windows`, `mac`, and `linux` channels. The `profile:me` scope supplies the session-scoped `ITCHIO_API_KEY` used by desktop authentication.

## Local unsigned package

From `client/`:

```sh
npx -y bun run build
npx electron-builder --dir
../tools/validate_desktop_release.sh
```

Unsigned local output is for smoke testing only. Tagged CI builds fail when signing credentials are missing.

References: [SteamPipe uploads](https://partner.steamgames.com/doc/sdk/uploading), [Itch app manifests](https://itch.io/docs/itch/integrating/manifest.html), [Butler validation](https://itch.io/docs/itch/integrating/manifest/validating-your-manifest.html), and [electron-builder signing](https://www.electron.build/docs/features/code-signing/).
