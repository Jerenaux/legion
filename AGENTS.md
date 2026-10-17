# Repository instructions

## Emberhall branding and compatibility

Use **Emberhall** in player-facing copy and the approved Emberhall logos. See
`docs/branding.md` for assets and compatibility identifiers. Keep the `client`
save directory, `com.legion.game` app ID, `Legion` executable filenames,
`app://legion/` origin and `legion://` invitation links stable: changing those
is a migration, not a branding edit.

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

## Silent headless verification

Run all headless tests, screenshot captures and browser previews **without audible sound**. Mute output at the browser/Electron boundary before loading the game: use Chromium `--mute-audio` or Electron `webContents.setAudioMuted(true)`. Muting only HTML audio or game settings is insufficient because Phaser/Web Audio can still play. Keep audio processing available for audio-recovery checks; never change Jerome's system volume or mute his apps.

## App verification cleanup

When opening the app to check your work, close the app instance you opened as soon as verification is finished, including after failed or interrupted checks. Do not close an app instance Jerome already had open.

## No TDD and no UI tests

**Never use test-driven development (TDD)** and never write tests first. Implement the change, then verify it.

**Never write UI or frontend tests.** Do not add automated checks of what the interface shows or how it looks or behaves on screen: text, labels, wording, translated strings, number or turn formatting, icons, tooltips, hover cards, dialogs, menus, the combat dock, keyboard/pointer UI flows, layout, sizes, overflow, scrolling, or styling. This applies to new scripts and to new assertions inside existing scripts.

When a UI change breaks an existing UI assertion, **delete the assertion**; do not update, rewrite or replace it with a "behavioral" equivalent. Verify UI work by rebuilding the app and looking at it, with screenshots when useful.

The only client-side automated checks are the existing smoke tests for startup and authentication, packaged routing, error reporting and replay privacy, crash recovery, and match readiness. The guide, localization, gifts, roster, Tower and preview scripts only capture screenshots for manual review.

## Testing policy

Do not write unit tests or restore the removed unit-test suites. Implement the change first, then validate it through the smallest relevant integration, end-to-end, smoke, or deployment-contract check.

Tests must exercise interactions between real production components or an actual system boundary: HTTP/Socket.IO, Firestore emulators, native libraries, a packaged app, a browser, or a CLI process. Mock external services or control time when needed for an integration scenario; do not replace the collaborating game logic with mocks and call it an integration test. Do not add isolated helper/class/component tests, even for regressions or security fixes; cover those behaviors through an appropriate integrated flow instead.

Keep the existing backend integration and smoke suites, lint, type checks, and build checks. Never add UI tests (see above). See `docs/testing.md` for the retained suites and commands. This policy supersedes test-first instructions in historical plans and generic skill workflows.

## Static analysis

Run `bun run lint` from the repository root for functional Biome diagnostics. The command deliberately skips the `style` and `complexity` rule groups and does not run the formatter. Do not replace it with `biome check`, which also checks formatting.

Biome complements rather than replaces TypeScript. Run `bunx tsc --noEmit` in `client`, `server`, `matchmaker`, and `api/functions` when validating types.

Review player-facing copy by reading the screen and following `docs/game-ui-writing.md`, never through tests. Copy and UI changes must never require test changes.

## Electron startup routing

Packaged builds must open `app://legion/`, using `PACKAGED_APP_URL` from `client/electron/protocol.js`. Do not load `app://legion/index.html`: Preact Router reads that as the `/index.html` application route, which bypasses the title screen and leaves the authenticated home content empty. The custom protocol already maps `/` to the bundled `index.html` file.

Local development starts at `http://localhost:8080/`, so it cannot catch a packaged-only entry-path regression by itself. When changing the Electron entry URL, custom protocol, or top-level routes, verify the packaged-root flow with `bun run test:guide` and smoke-test a packaged build.

## Weekly leagues

League promotion and demotion happens only in the `leaguesUpdate` Friday 19:00 UTC scheduled function. Do not derive a player's league directly from ELO. Preserve the low-cost design: query only participants from the season that just ended, calculate ranks on demand, write only promotion/demotion and podium-reward recipients, and let `seasonId` reset statistics lazily. Never restore per-player rank writes, Firestore rank-update triggers, or a global weekly stats reset.

Weekly standings and rollover eligibility require `leagueStats.hasRankedResult === true`
for the current/ending `seasonId`. Only real ranked-result processing sets this flag;
new accounts, practice/casual games and inactive-player data must never qualify.
Keep combat's earned league badge separate from seasonal rank (zero means unranked,
never a displayed rank zero). See `docs/backend-startup.md` for the legacy backfill.

Keep every production composite index in `firestore.indexes.json`; the API deployment applies that file before deploying Functions. Any new or changed Firestore query must include its required index in the same PR.

## Error reporting

Preserve early Sentry initialization in Electron, Bun services, and Firebase. Register Firebase HTTP/scheduled handlers through `api/functions/src/telemetry.ts` so reports flush before serverless execution ends. Follow `docs/error-reporting.md`; do not log credentials, bundle upload tokens/source maps, or enable backend tracing/profiling by default. Keep the real SDK loopback smoke test in `bun run test:guide` passing.

The external `@jerenaux/replay` Electron library records composed game-window frames into the central Replay dashboard. Preserve password/private-element masking, text-input key exclusion, sender validation, the disk outbox and loopback-only fixture uploads. Only packaged Steam/Itch release builds stamped with `replayChannel: store` record; local builds, CI and `--smoke-test` do not. Capture starts only after AuthProvider completes platform verification and custom-token sign-in; a restored cached Firebase user must never start or identify a replay. Sentry retains errors/crashes/freezes and source maps, with replay session links, but Sentry Replay and LogRocket are disabled. Keep `PACKAGED_CSP` restricted to bundled scripts and local/blob workers. See `docs/error-reporting.md`.

## Match timing

Follow `docs/match-timing.md`. Sending a snapshot is not permission to start combat: wait for every human slot's rendered-arena acknowledgement. Keep delayed combat effects on the shared `CombatClock` so practice reconnects cannot advance spells or consume turns while loading. Preserve the installed-client compatibility path and the packaged readiness smoke tests.

## Player guide

When changing player-facing rules, controls, unlocks, or the illustrated UI, update the bundled guide in `client/src/components/GuidePage.tsx` in the same batch. The implemented game—not the legacy external guide—is authoritative. Follow `docs/player-guide.md` to refresh its cropped screenshots; run `bun run test:guide` from `client` when changing functional flows or guide routing, not for presentation-only edits. Never ship the screenshot fixtures in the release bundle.

## Game UI and writing

Follow the dialog-layering rules in `DESIGN.md`: use body portals for full-window
dialogs and preserve the game root's stacking isolation. Check dialogs over the
actual scene when changing navigation, transforms, isolation or z-indexes; a large
z-index inside a lower stacking context does not make a dialog topmost.

Read `docs/game-ui-writing.md` before changing player-facing copy or UI. Its rejected tutorial examples are regression examples: do not reintroduce slogan chains, balanced reassurance, redundant introductions, or vague promises of ease. Give each line a concrete gameplay purpose. Use the game's characters, icons, action controls and feedback to teach; remove text that merely describes what the UI already makes clear. Design game screens, not website landing pages. Follow `DESIGN.md` for the game's visual vocabulary, and inspect the result in context with long translations and enlarged text. Close any app opened to verify your work when the check is finished.
