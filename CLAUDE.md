# Repository instructions

Follow `AGENTS.md` for the full repository instructions. Read it before starting work: it holds rules this file does not repeat, such as version bumps and release policy.

## Always rebuild the local app

After **every** change to the game, rebuild the local macOS ARM64 app without waiting for Jerome to ask. A change is not finished until this rebuild succeeds; report any build failure.

- Build from the branch being tested, in the main `~/Code/legion` checkout: `cd client && BUILD_TARGET=electron bun run build && bunx electron-builder --mac --arm64 --dir --config.directories.output=release-staging`, then replace `release/mac-arm64/Legion.app` with `release-staging/mac-arm64/Legion.app` and delete `release-staging`.
- Package into the staging folder, not straight into `release/`: electron-builder deletes `release/mac-arm64` first, and that fails with `ENOTEMPTY` whenever Finder has the folder open and rewrites its `.DS_Store`.
- The Electron build requires `API_URL`, `GAME_SERVER_URL` and `MATCHMAKER_URL`. Export them from the repository's GitHub Actions variables (`gh variable list`), as the desktop release workflow does.
- The result must replace `client/release/mac-arm64/Legion.app`. Do this even when screenshots, smoke tests or a temporary fixture build already verified the change, because none of them update the app Jerome launches.
- Rebuilding does not authorize launching the app or a store release. Never close an app instance Jerome has open (`pgrep -x Legion`); if the build cannot replace the bundle while it runs, say so.

## No TDD and no UI tests

**Never use test-driven development (TDD)** and never write tests first. Implement the change, then verify it.

**Never write UI or frontend tests.** Do not add automated checks of what the interface shows or how it looks or behaves on screen: text, labels, wording, translated strings, number or turn formatting, icons, tooltips, hover cards, dialogs, menus, the combat dock, keyboard/pointer UI flows, layout, sizes, overflow, scrolling, or styling. This applies to new scripts and to new assertions inside existing scripts.

When a UI change breaks an existing UI assertion, **delete the assertion**; do not update, rewrite or replace it with a "behavioral" equivalent. Verify UI work by rebuilding the app and looking at it, with screenshots when useful.

The only client-side automated checks are the existing smoke tests for startup and authentication, packaged routing, error reporting and replay privacy, crash recovery, and match readiness. The guide, localization, gifts, roster, Tower and preview scripts only capture screenshots for manual review.

## Silent headless verification

Run all headless tests, screenshot captures and browser previews **without audible sound**. Mute output at the browser/Electron boundary before loading the game: use Chromium `--mute-audio` or Electron `webContents.setAudioMuted(true)`. Muting only HTML audio or game settings is insufficient because Phaser/Web Audio can still play. Keep audio processing available for audio-recovery checks; never change Jerome's system volume or mute his apps.

## Testing policy

Do not write unit tests or restore the removed unit-test suites. Implement the change first, then validate it through the smallest relevant integration, end-to-end, smoke, or deployment-contract check.

Tests must exercise interactions between real production components or an actual system boundary: HTTP/Socket.IO, Firestore emulators, native libraries, a packaged app, a browser, or a CLI process. Mock external services or control time when needed for an integration scenario; do not replace the collaborating game logic with mocks and call it an integration test. Do not add isolated helper/class/component tests, even for regressions or security fixes; cover those behaviors through an appropriate integrated flow instead.

Keep the existing backend integration and smoke suites, lint, type checks, and build checks. Never add UI tests (see above). See `docs/testing.md` for the retained suites and commands. This policy supersedes test-first instructions in historical plans and generic skill workflows.

