# Desktop release operator runbook

Use this when managing a release for Jerome. The agent performs the commands, monitors the jobs, checks the stores, and reports the result; Jerome should only need to intervene for authentication, unavailable tools, or verification the agent cannot perform.

## Scope and completion

A release requires an explicit request. Merging a PR is not permission to release. Respect any store restriction in that request. For a requested Steam release, Jerome's standing preference is to update the **public Legion Demo**, unless he asks for a private-only build. Uploading to `playtest` is a staging step, not completion. Never target the full game or the separate Playtest app.

The workflow deliberately cannot promote Steam's public branch. The operator performs that promotion separately after the checks below; this does not mean Jerome must perform it personally.

| Destination | Complete when |
| --- | --- |
| Itch | Every requested channel has the intended product version, processing has completed, and the installed build has been checked. |
| Steam private | The intended Demo Build ID is assigned to the requested private branch and verified. |
| Steam public | That verified Build ID is assigned to the Demo's default/public branch and the public installation receives it. |

Report upload success, store processing, gameplay verification, and public promotion separately. Never treat a green upload job as proof of all four.

## 1. Establish the release candidate

1. Read [repository instructions](../AGENTS.md), [Steam deployment](../STEAM_DEPLOYMENT.md), and the [release checklist](desktop-release-checklist.md).
2. Check the worktree without discarding changes. Fetch `origin/main`; confirm the intended PRs are merged and CI passed for the candidate commit. Do not bundle unrelated work or release from a feature branch.
3. Record the full candidate SHA and `client/package.json` version. All selected stores must consume artifacts from one workflow run. Do not bump the version merely to dispatch a release of an already-versioned batch.
4. Run `bash tools/validate_desktop_release.sh`. Confirm required configuration exists without printing secret values:
   - Repository variables: `API_URL`, `GAME_SERVER_URL`, `MATCHMAKER_URL`.
   - Build secret: `SENTRY_AUTH_TOKEN` for source-map uploads.
   - `desktop-release` environment: `BUTLER_API_KEY`, `ITCH_TARGET`, `STEAM_USERNAME`, and access to `GCP_SA_KEY` as used by the workflow.
   - Steam's reusable credential lives in Secret Manager as `STEAM_CONFIG_VDF`, project `legion-32c6d`; follow the dedicated authentication instructions rather than copying desktop Steam credentials.
5. Check signing separately. The workflow supports optional Windows and Apple signing credentials; a successful package build does not prove signing/notarization occurred. Do not purchase certificates or change billing as part of a routine release.
6. Record the previous public Steam Build ID and previous Itch versions/artifact run when accessible, for rollback.

## 2. Dispatch once, from main

For a release to both stores:

```sh
gh workflow run release-desktop.yml --repo Jerenaux/legion --ref main \
  -F publish_itch=true -F upload_steam=true -F steam_branch=playtest
```

For Itch-only, set `upload_steam=false`. For Steam-only, set `publish_itch=false`. For artifacts only, set both to false. Never pass `public` or `default` as `steam_branch`.

Capture the returned run URL/ID. If the CLI does not return it, list recent manual runs and identify the correct one by SHA and creation time; do not assume another operator's latest run is yours:

```sh
gh run list --repo Jerenaux/legion --workflow release-desktop.yml \
  --event workflow_dispatch --branch main --limit 10 \
  --json databaseId,headSha,createdAt,status,url
gh run view <run-id> --repo Jerenaux/legion --json headSha,status,conclusion,jobs
```

Verify the run's SHA matches the recorded candidate. `--ref main` resolves at dispatch time; a concurrent merge can change it. If it differs, stop and inspect the new candidate before treating it as the intended release.

## 3. Monitor builds and uploads

```sh
gh run watch <run-id> --repo Jerenaux/legion --interval 15 --exit-status
gh run view <run-id> --repo Jerenaux/legion --log-failed
```

Monitor every selected job, not just the first successful platform. Keep Jerome informed during long builds. If interrupted, resume monitoring the existing run instead of dispatching a duplicate.

The workflow builds Windows x64, universal macOS (Intel and Apple Silicon), and Linux x64; runs native startup smoke tests; and archives the store directories. Itch gets all three channels. Steam Demo app `3996730` gets macOS depot `3996731` and Windows depot `3996732`, using the same artifacts as Itch. Source maps must upload to Sentry but must not ship in the archives.

After upload, extract the Steam Build ID from the successful upload log and associate it with the candidate SHA/version. Keep only that identifier and relevant status, not raw credential-bearing logs. Verify Itch channel versions and processing status in Butler/the dashboard; uploads may need further processing before installations can update.

## 4. Verify and promote Steam

1. Install/update the exact private Demo build. Check startup, Steam authentication, matchmaking, a completed match, reconnect, and clean exit on Windows and macOS as specified in [Steam deployment](../STEAM_DEPLOYMENT.md). Keep sound muted during agent testing. Check Itch/direct-download authentication too. Fixture smoke tests do not prove production platform authentication or matchmaking.
2. Record which checks actually ran, on which platform and Build ID. If a required platform or gameplay check is unavailable, report the missing verification and ask for help or an explicit decision; do not silently mark it passed.
3. Use an available authenticated browser to open [Legion Demo builds](https://partner.steamgames.com/apps/builds/3996730). Confirm the app is **Legion Demo (3996730)**. Select the verified Build ID for the default/public branch, review the confirmation, and submit it. Follow any Steam Guard confirmation requested by Steam.
4. Reload the builds page and verify the default branch points to that exact Build ID. Update a public-branch installation and confirm the installed build/version. Preserve the previous public Build ID for rollback.
5. Check [Sentry](error-reporting.md) if telemetry changed. Local ingestion tests are not proof of a replay being stored or playable in the live dashboard. Do not create synthetic production recordings unless explicitly requested.

Browser controls change, so inspect the live page rather than relying on guessed selectors. A successful private upload does not establish a Steamworks browser login or authorize bypassing Steam Guard.

## Failure and recovery

| Situation | Operator response |
| --- | --- |
| Build/test failure | Inspect the failing step; do not promote. Code fixes get a separate branch/PR and the normal version bump, then a new main-only release. |
| Transient upload failure | Inspect the successful and failed jobs first. If appropriate, use `gh run rerun <run-id> --repo Jerenaux/legion --failed` to retry the original run without rebuilding successful jobs. Confirm original artifacts remain available. |
| Only one store/channel updated | Report the partial release precisely. Do not claim store parity. Retry the missing upload; avoid a new full release just to repeat a successful store upload. |
| Steam credential expired/rejected | Follow the isolated Linux SteamCMD renewal procedure in `STEAM_DEPLOYMENT.md`. Ask Jerome only for interactive password/Guard input. Never expose credentials in commands, logs, PRs, or chat. Do not renew while an upload is using the same account. |
| Steam Guard/browser login needed | Have Jerome complete the secure sign-in/confirmation, then resume at the existing Build ID. Do not request another build. |
| Browser tooling unavailable | Distinguish a tool connection error from a Steam login failure. Try the supported connection/reset procedure; do not weaken sandbox settings, extract browser cookies, or claim a speculative version mismatch is proven. Report the exact blocker and give Jerome the Demo builds URL and Build ID, or resume after tool access is restored. |
| Upload succeeded, public promotion blocked | Leave the private build in place; explicitly report **Steam public unchanged**. No rebuild is needed to promote the same verified build later. |
| Regression after public release | Identify the last known-good release and get a rollback decision. Reassign Steam's default branch to its previous Build ID and verify it. For Itch, reuse retained known-good artifacts and their matching package version through an approved recovery upload; never relabel bad/new binaries with an old version. Report any temporary store mismatch. |

Do not automatically cancel an active Steam upload: it may be rotating its reusable login. The workflow serializes Steam jobs and saves valid updated credentials even after some failures. Never overwrite the stored credential with an empty or invalid cache.

## Final handoff

Include the product version, commit, workflow link, Itch channel status, Steam Build ID and branch, actual verification performed, and outstanding blockers. Say explicitly whether public Steam promotion happened. Do not label the release complete while a requested destination or required verification is still pending.

No passwords, API keys, cookies, Steam login caches, or Guard codes belong in the release record. A user-facing summary or linked run is enough; no additional version file or release automation is required.
