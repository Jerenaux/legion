# Legion Demo releases on Steam

Desktop releases are manual-only, from `main`, through `.github/workflows/release-desktop.yml`. Merge the intended changes first. Tags and merges do not trigger desktop releases.

## Destination

The workflow uploads **Legion Demo**, not the full game or the separate Steam Playtest app. These IDs come from the former `deploy_steam.sh demo` script and match Steam's published depot configuration:

| Target | ID | Artifact directory |
| --- | --- | --- |
| Legion Demo | `3996730` | |
| macOS depot | `3996731` | `mac` |
| Windows depot | `3996732` | `windows` |

The Demo has no Linux depot. Linux artifacts remain available for Itch. Never substitute the full-game App ID `3729580` or assume Windows is the first depot. The wishlist button should still link to the full game's store page.

## Steam upload authentication

Use a Steam build account with access to the Demo and only the required upload permissions. Run these commands in your own terminal, using your SteamCMD executable if it is not on `PATH`:

```sh
steamcmd +login <steam-build-account> +quit
steamcmd +login <steam-build-account> +quit
```

Enter the password and complete Steam Guard locally. The second login must succeed without another password or Guard prompt. Never paste the password into chat, a command argument, the repository, or a PR.

Store `STEAM_USERNAME` and the base64-encoded SteamCMD `config/config.vdf` as GitHub Actions secrets in the `desktop-release` environment. On macOS the configuration is normally under `$HOME/Library/Application Support/Steam/config/config.vdf`; on Linux, use the configuration belonging to the SteamCMD installation that you authenticated.

```sh
gh secret set STEAM_USERNAME --env desktop-release
base64 < "$HOME/Library/Application Support/Steam/config/config.vdf" |
  gh secret set STEAM_CONFIG_VDF --env desktop-release
```

The pipe stores the credential directly without displaying it or creating another credential file. Do not print or commit the configuration. If Steam expires the cached login, repeat the local authentication and replace the secret. Restrict the `desktop-release` environment to deployments from `main`.

## Steam player authentication

Upload credentials and player-login credentials are different. In Steamworks, go to **Users & Permissions → Manage Groups**, select/create a group containing **Legion Demo (`3996730`)**, and create a publisher Web API key with **General** permissions. Keep this key server-side:

```sh
node api/functions/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set STEAM_WEB_API_KEY --project legion-32c6d
```

Enter the key at the local prompt. The `createPlatformSession` and `linkPlatformIdentity` Functions bind this secret and verify tickets against Demo App ID `3996730`, using the `legion` ticket identity. Provision the secret before merging changes that deploy these bindings.

The desktop shell takes its App ID from Steam's `SteamAppId` launch environment. `STEAM_APP_ID` is only an explicit local-test override. Itch launcher sessions keep their Itch identity, and direct downloads do not initialize Steam just because it happens to be installed.

## Release and verification

1. Run the checks in `docs/desktop-release-checklist.md`, including `tools/validate_desktop_release.sh`.
2. Create a private beta branch such as `playtest` **inside the Demo app** in Steamworks. This is not the separate Steam Playtest app.
3. Once the changes are merged, manually build and upload from `main`:

   ```sh
   gh workflow run release-desktop.yml --ref main -F upload_steam=true -F steam_branch=playtest -F publish_itch=false
   ```

   Add `publish_itch=true` only when an Itch release is also requested. Both stores consume the same platform artifacts and product version from `client/package.json`.
4. Install the Demo's private branch on Windows and macOS. Verify startup, Steam login, matchmaking, a completed match, reconnect, and clean exit. Verify a direct download and an Itch session still work too.
5. Only after verification, manually promote that exact Build ID to the Demo's public/default branch in [Steamworks](https://partner.steamgames.com/apps/builds/3996730). The workflow rejects public/default destinations and never promotes them automatically. Keep the previous Build ID for rollback.

Manual builds allow unsigned packages; signing and notarization use the configured credentials when available. Signing setup is separate from Steam upload authentication.

References: [Steam Demo configuration](https://partner.steamgames.com/doc/store/application/demos), [GameCI Steam authentication](https://game.ci/docs/github/deployment/steam/), and [publisher Web API keys](https://partner.steamgames.com/doc/webapi_overview/auth).
