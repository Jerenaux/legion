# Testing

Do not use TDD or write unit tests. Implement first, then verify the relevant
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
  late results and retry recovery without touching production accounts.
- `cd client && bun run test:guide` and `bun run test:guide --dock`: real packaged
  renderer, Phaser combat, keyboard/menu flows, recovery and local replay capture.
  CI runs these on Windows and macOS. Other scenario switches remain available
  for gifts, Tower, localization and UI flows; see `docs/player-guide.md`.
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

The matchmaker has no isolated `test` script; validate it through the backend
integration runner. Tests with fake Firestore implementations have been removed;
use the emulator for persistence changes. The retained suites do not cover every
case formerly asserted by unit tests.

## Static checks

Run `bun run lint` at the repository root, `bunx tsc --noEmit` in client, server,
matchmaker and api/functions, and `bun run locales:check` in client. Keep build,
package and deployment checks; they are not unit tests. Test-only changes do not
require a product version bump.
