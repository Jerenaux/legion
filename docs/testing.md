# Testing

Never use TDD, never write unit tests, and never write UI or frontend tests (no
checks of text, formatting, tooltips, hover cards, menus, the combat dock, layout
or styling). When a UI change breaks an existing UI assertion, delete it. Verify
UI work by looking at the rebuilt app. Implement first, then verify the relevant
integrated behavior. This applies to fixes and security changes too. The policy
in AGENTS.md and CLAUDE.md supersedes test-first steps in historical plans.

## Retained checks

- `cd server && bun run test`: real combat interactions between Game, players,
  teams, spells/items, terrain, turn scheduling and the combat clock; practice
  setup and Tower encounters; HTTP and Socket.IO origin handling over loopback.
  Time and external persistence/transport may be controlled without replacing
  the collaborating combat implementation.
- `cd api/functions && bun run test`: Firebase HTTP/scheduled handlers with the
  real Sentry SDK and a local ingestion server, plus deployment configuration
  contracts across Functions, Firestore and CI.
- `cd client && bun run test`: loads the real Steam SDK library and binds its
  native launch exports without authenticating to Steam.
- `cd client && bun run test:startup`: real authentication renderer, native IPC
  and Firebase SDK with loopback services; checks startup deadlines, cancellation,
  late results, bounded transient-request retries and recovery without touching production accounts.
  This authentication integration check also runs in PR CI.
- `cd client && bun run test:guide`: packaged smoke checks only — error reporting
  and replay privacy, music hand-off and interruption recovery, repeated-match teardown, match readiness,
  socket recovery and crash recovery. The full guide smoke runs with `test:startup` on Windows and
  macOS only as the first job of the manual desktop release workflow, which stops
  before building if it fails; it does not run on PRs, pushes or a schedule.
  Audio recovery can also run alone with `node tools/guide/capture.cjs --audio-recovery`
  in `client` (real media/Phaser contexts, simulated platform interruptions and local Sentry ingestion).
  Screenshot switches (`--images`, `--roster-images`, `--gifts`, `--tower-unlock`,
  `--tower-images`, `--localization`, `--tutorial`) only capture screenshots for
  manual review; `--tutorial` also keeps its match-readiness checks.
- `node tools/backend/run.cjs` from the repository root: isolated Auth, Firestore
  and Functions emulators plus real server/matchmaker processes and HTTP/Socket.IO
  clients. Includes account bootstrap, matchmaking, progression, indexed opponents,
  gift redemption and community flows. Requires service dependencies and Java 21+;
  it never uses production player data. See `docs/backend-startup.md`.
- `node --test tools/steam-credentials.test.cjs`: executes the credential CLI in
  child processes and verifies its filesystem/output contract with synthetic data.
  `tools/validate_desktop_release.sh` also checks the real release definitions and
  credential-preservation shell steps without store uploads.
- `node website/smoke.cjs` and the packaged executable's `--smoke-test`: existing
  browser/site and offline packaged startup/shutdown checks, run by CI/releases.
  Packaged shutdown uses the real preload `quitApp` IPC with a process-exit deadline.

The matchmaker has no isolated `test` script; validate it through the backend
integration runner. Tests with fake Firestore implementations have been removed;
use the emulator for persistence changes. The retained suites do not cover every
case formerly asserted by unit tests.

## Static checks

Run `bun run lint` at the repository root, `bunx tsc --noEmit` in client, server,
matchmaker and api/functions, and `bun run locales:check` in client. Keep build,
package and deployment checks; they are not unit tests. Test-only changes do not
require a product version bump.

- `bun run test:freeze` in `client`: real Electron main-thread freeze, Node stack, power transitions, and bounded diagnostic context, with an isolated temporary profile and local Sentry sink. No visible game window or production telemetry.
