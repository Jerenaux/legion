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

Use a Steam build account with access to the Demo and only the required upload permissions. Authenticate an **isolated native Linux SteamCMD installation**, not the configuration shared with your desktop Steam launcher. On Apple Silicon, use a native x86 Linux environment (for example Cloud Shell); 32-bit SteamCMD is not reliably supported by Docker's Mac emulation.

Run these commands in that installation, using your SteamCMD executable if it is not on `PATH`:

```sh
steamcmd +login <steam-build-account> +quit
steamcmd +login <steam-build-account> +quit
```

Enter the password and complete Steam Guard locally. The second login must succeed without another password or Guard prompt. Never paste the password into chat, a command argument, the repository, or a PR.

Keep `STEAM_USERNAME` in the GitHub `desktop-release` environment. Store the **raw** authenticated `config/config.vdf` in the `STEAM_CONFIG_VDF` secret in Google Secret Manager, project `legion-32c6d`. Use the actual configuration read by SteamCMD, normally `$HOME/Steam/config/config.vdf` on Linux—not the executable directory.

```sh
gh secret set STEAM_USERNAME --env desktop-release
STEAM_USERNAME=<steam-build-account> node tools/steam-credentials.cjs validate <path-to-config.vdf>
gcloud secrets versions add STEAM_CONFIG_VDF --project=legion-32c6d --data-file=<path-to-config.vdf>
```

These commands do not display credentials. The validator rejects empty/cleared caches, malformed files, multiple accounts, a wrong account, and files over Secret Manager's 64 KiB limit. Do not print or commit the configuration, or put it in Actions artifacts/caches. Restrict the `desktop-release` environment to deployments from `main`.

The desktop launcher can clear SteamCMD's shared Mac login cache. Steam can also update the credential after login: [Valve requires preserving the updated configuration between runs](https://partner.steamgames.com/doc/sdk/uploading#5). A static GitHub secret snapshot alone is therefore insufficient. Do not renew CI credentials from your normal desktop Steam profile or sign in interactively with the build account while an upload is running.

The workflow reads the latest Secret Manager version, validates/masks it, and passes its base64 encoding to the upload action. After the action, it saves changed, valid credentials back—even if authentication succeeded but a subsequent upload operation failed. It never replaces the stored credential with a cleared or malformed cache. Steam jobs are serialized, without cancelling an active upload, to prevent concurrent token updates.

The existing `github-actions` service account needs `roles/secretmanager.secretAccessor` and `roles/secretmanager.secretVersionAdder` **on this secret only**, using the existing `GCP_SA_KEY` authentication. No additional GitHub token or stored Steam password is needed. Older secret versions provide recovery history; disable obsolete versions when no longer needed. If Steam expires or revokes the login, repeat the isolated authentication and add a fresh secret version.

Keep `XDG_DATA_HOME` configured as in the workflow so the Debian launcher reuses the image's preinstalled SteamCMD executable. **Leave `STEAM_HOME` unset**: the upload action then writes `config/config.vdf` under `$HOME/Steam`, which is where SteamCMD reads it. The executable directory and Steam's configuration directory are different; putting credentials beside the executable causes `Cached credentials not found` even when the GitHub secret is present.

This separation was verified with native Linux file-access tracing against the upload image: with the workflow's Steam environment settings and a dummy configuration beside the executable, SteamCMD opened only `$HOME/Steam/config/config.vdf`. Docker actions map `/github/home` to `$RUNNER_TEMP/_github_home` on the runner; the preservation step reads the updated file there. When changing the uploader or its container, verify the actual file reads and write-back path again. `tools/validate_desktop_release.sh` guards these paths, secret restoration/preservation, upload serialization, and credential validation.

## Steam player authentication

Upload credentials and player-login credentials are different. In Steamworks, go to **Users & Permissions → Manage Groups**, select/create a group containing **Legion Demo (`3996730`)**, and create a publisher Web API key with **General** permissions. Keep this key server-side:

```sh
node api/functions/node_modules/firebase-tools/lib/bin/firebase.js functions:secrets:set STEAM_WEB_API_KEY --project legion-32c6d
```

Enter the key at the local prompt. The `createPlatformSession` and `linkPlatformIdentity` Functions bind this secret and verify tickets against Demo App ID `3996730`, using the `legion` ticket identity. Provision the secret before merging changes that deploy these bindings.

After selecting General permissions in Steamworks, click Save Changes **and confirm the dialog**; reload to verify that General remains checked. Before deployment, grant the Functions runtime service account `roles/secretmanager.secretAccessor` on this secret. CI does not need permission to change secret IAM policies.

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
