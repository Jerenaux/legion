# Repository instructions

## Branches and desktop releases

- Start each independent, coherent work batch on a new branch from the latest `main`. Do not accumulate unrelated requests on one branch or reuse a merged branch.
- Commit and push each completed batch. Merge through its own PR when authorized; keep later independent work separate.
- Rebuild the local macOS ARM64 app after every completed work batch, without waiting for Jerome to ask. Build from the branch being tested and always replace `client/release/mac-arm64/Legion.app` in the main `~/Code/legion` checkout. Report any build failure before considering the batch complete. This local test build does not authorize a store release or launching the app; respect any request for headless-only verification.
- Desktop release builds are manual-only and must use `main`, after all intended changes have been merged. Never release from a feature branch, and do not add automatic desktop release triggers on merges, pushes, or tags.
- Use `gh workflow run release-desktop.yml --ref main` with the explicitly requested store-upload inputs. Do not trigger a release merely because work was merged. Normal CI checks and backend deployment workflows remain automatic.
- Steam releases target **Legion Demo (`3996730`)** only: macOS depot `3996731`, Windows depot `3996732`, no Linux depot. Never target the full game (`3729580`) or the separate Playtest app. **Update the public/default Demo by default**, unless Jerome explicitly requests a private-only release or otherwise excludes public Steam publication. Follow `STEAM_DEPLOYMENT.md`: the workflow stages the build on `playtest`, then promote that exact verified Build ID through Steamworks or the publisher API. Do not stop at the private upload or ask for separate publication approval; request any confirmation Valve requires and verify the public branch actually changed. Preserve the previous public Build ID for rollback.

## Legion versioning

`client/package.json` is the single source of truth for the Legion product version. Desktop packages and Itch channels must use that exact version. Do not create another version file or independently version each platform.

Every coherent batch that changes shipped code, game assets, dependencies, infrastructure, or release behavior must bump the version once before its final commit. Documentation-only, test-only, and guide-only changes (copy, presentation, or illustrations) do not require a bump. Batches that also change gameplay or other shipped behavior still follow the normal versioning rules.

Use Semantic Versioning:

- While the game is below `1.0.0`, bump PATCH for compatible fixes and maintenance, and MINOR for features or breaking changes.
- From `1.0.0` onward, bump PATCH for compatible fixes, MINOR for backward-compatible features, and MAJOR for incompatible save-data, API, network-protocol, or platform changes.
- Prerelease identifiers such as `0.2.0-beta.1` are allowed for explicitly staged releases.

Make the bump after syncing the latest `main`, so concurrent branches do not reuse a version. If `main` already contains the intended next version, increment again. Never create a Git tag as part of an ordinary version bump.

If explicitly requested, release tags must be `v<version>`, for example `v0.2.0`, and must exactly match `client/package.json`. Tags do not trigger desktop builds. Manual desktop releases publish the package version from `main` to every selected Itch channel.

## App verification cleanup

When opening the app to check your work, close the app instance you opened as soon as verification is finished, including after failed or interrupted checks. Do not close an app instance Jerome already had open.

## Static analysis

Run `bun run lint` from the repository root for functional Biome diagnostics. The command deliberately skips the `style` and `complexity` rule groups and does not run the formatter. Do not replace it with `biome check`, which also checks formatting.

Biome complements rather than replaces TypeScript. Run `bunx tsc --noEmit` in `client`, `server`, `matchmaker`, and `api/functions` when validating types.

For presentation-only UI work (for example card hover effects, tooltip styling, spacing, or colors), do not add or run automated tests just to verify appearance. Inspect screenshots manually when useful or requested. Keep focused tests for behavior such as gameplay, navigation, accessibility, error handling, and security.

## Electron startup routing

Packaged builds must open `app://legion/`, using `PACKAGED_APP_URL` from `client/electron/protocol.js`. Do not load `app://legion/index.html`: Preact Router reads that as the `/index.html` application route, which bypasses the title screen and leaves the authenticated home content empty. The custom protocol already maps `/` to the bundled `index.html` file.

Local development starts at `http://localhost:8080/`, so it cannot catch a packaged-only entry-path regression by itself. When changing the Electron entry URL, custom protocol, or top-level routes, keep the packaged-root assertion in `client/electron/__tests__/security.test.js` passing and smoke-test a packaged build.

## Weekly leagues

League promotion and demotion happens only in the `leaguesUpdate` Friday 19:00 UTC scheduled function. Do not derive a player's league directly from ELO. Preserve the low-cost design: query only participants from the season that just ended, calculate ranks on demand, write only promotion/demotion and podium-reward recipients, and let `seasonId` reset statistics lazily. Never restore per-player rank writes, Firestore rank-update triggers, or a global weekly stats reset.

Keep every production composite index in `firestore.indexes.json`; the API deployment applies that file before deploying Functions. Any new or changed Firestore query must include its required index in the same PR.

## Error reporting

Preserve early Sentry initialization in Electron, Bun services, and Firebase. Register Firebase HTTP/scheduled handlers through `api/functions/src/telemetry.ts` so reports flush before serverless execution ends. Follow `docs/error-reporting.md`; do not log credentials, bundle upload tokens/source maps, or enable backend tracing/profiling by default. Keep the real SDK loopback smoke test in `bun run test:guide` passing.

Sentry and LogRocket record the same eligible store sessions; preserve their shared gate and privacy policy. Preserve the shared `PACKAGED_CSP`: bundled scripts plus the exact LogRocket CDN origin, with local/blob replay workers. The guide smoke test must verify real replay envelopes, nonblank combat canvas frames, and input/network redaction using local ingestion only. Never send CI recordings to production. Replay frame rate and private `app://` assets have the limitations documented in `docs/error-reporting.md`.

## Match timing

Follow `docs/match-timing.md`. Sending a snapshot is not permission to start combat: wait for every human slot's rendered-arena acknowledgement. Keep delayed combat effects on the shared `CombatClock` so practice reconnects cannot advance spells or consume turns while loading. Preserve the installed-client compatibility path and the packaged readiness smoke tests.

## Player guide

When changing player-facing rules, controls, unlocks, or the illustrated UI, update the bundled guide in `client/src/components/GuidePage.tsx` in the same batch. The implemented game—not the legacy external guide—is authoritative. Follow `docs/player-guide.md` to refresh its cropped screenshots; run `bun run test:guide` from `client` when changing functional flows or guide routing, not for presentation-only edits. Never ship the screenshot fixtures in the release bundle.

## Game UI and writing

Read `docs/game-ui-writing.md` before changing player-facing copy or UI. Its rejected tutorial examples are regression examples: do not reintroduce slogan chains, balanced reassurance, redundant introductions, or vague promises of ease. Give each line a concrete gameplay purpose. Use the game's characters, icons, action controls and feedback to teach; remove text that merely describes what the UI already makes clear. Design game screens, not website landing pages. Follow `DESIGN.md` for the game's visual vocabulary, and inspect the result in context with long translations and enlarged text. Close any app opened to verify your work when the check is finished.
