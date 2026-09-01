# Steam and Itch Desktop Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Legion as a secure, reliable, compact desktop-first Steam and Itch application while retaining fake queue counts, synthetic players/ranking, and LogRocket.

**Architecture:** Keep the Phaser/Preact renderer, Electron shell, Firebase token layer, Firestore, and the two singleton realtime services. Replace browser-era entry points and global rank materialization with a desktop platform/session adapter, indexed reads, fail-closed API middleware, recoverable sockets, and store-native build pipelines.

**Tech Stack:** TypeScript, Preact, Phaser, Electron, Firebase Auth/Functions/Firestore, Express, Socket.IO, Cloud Run, Steamworks Web API, Itch API/Butler, GitHub Actions.

---

### Task 1: Record scope and protect explicit exceptions

**Files:**
- Create: `docs/superpowers/specs/2026-09-01-steam-itch-desktop-overhaul-design.md`
- Create: `docs/superpowers/plans/2026-09-01-steam-itch-desktop-overhaul.md`
- Create: `matchmaker/test/preservedSimulation.test.ts`
- Create: `client/src/__tests__/telemetryConfig.test.ts`

- [ ] Write tests that assert fake queue presentation remains enabled and LogRocket remains initialized.
- [ ] Run the focused tests and observe failures until stable exported configuration seams exist.
- [ ] Export the existing flags/configuration without changing behavior.
- [ ] Run focused tests and commit the design baseline.

### Task 2: Fail-closed API authentication and secret hygiene

**Files:**
- Modify: `api/functions/src/APIsetup.ts`
- Modify: `api/functions/src/playerAPI.ts`
- Modify: `api/functions/src/gameAPI.ts`
- Modify: `api/functions/src/dashboardAPI.ts`
- Modify: `api/functions/src/index.ts`
- Create: `api/functions/src/__tests__/auth.test.ts`
- Modify: `.gitignore`
- Delete: `client/.env`
- Delete: `matchmaker/.production.env`
- Delete: `server/.production.env`
- Modify: `matchmaker/Dockerfile`
- Modify: `server/Dockerfile`
- Modify: `storage.rules`
- Modify: `firebase.json`

- [ ] Add focused tests for invalid tokens, query-UID fallback, player/internal/admin guards, and health behavior.
- [ ] Run tests and confirm the insecure cases fail.
- [ ] Make `getUID` throw on verification failure; add reusable player, service, and admin guards.
- [ ] Protect mutation and dashboard handlers and remove the `getPlayerData` UID fallback/warmup hack.
- [ ] Remove tracked environments, ignore local environments, stop copying them into images, and version deny-by-default service rules.
- [ ] Build Functions and both Docker TypeScript targets; commit.

### Task 3: Replace rank fan-out with indexed leaderboard reads

**Files:**
- Modify: `api/functions/src/leaderboardsAPI.ts`
- Modify: `api/functions/src/index.ts`
- Modify: `api/functions/src/playerAPI.ts`
- Create: `api/functions/src/ranking.ts`
- Create: `api/functions/src/__tests__/ranking.test.ts`
- Create or modify: `firestore.indexes.json`

- [ ] Test deterministic ordering, top-N limits, synthetic-player inclusion, division thresholds, and personal count-query construction.
- [ ] Confirm tests fail against the old materialized-rank implementation.
- [ ] Implement pure ranking helpers and indexed Firestore queries.
- [ ] Remove rank trigger exports and manual rerank export, but preserve `updateInactivePlayersStats` and its synthetic writes.
- [ ] Add season-aware lazy stats initialization and required indexes.
- [ ] Run tests and Functions build; commit.

### Task 4: Platform session exchange

**Files:**
- Create: `api/functions/src/sessionAPI.ts`
- Create: `api/functions/src/platformIdentity.ts`
- Create: `api/functions/src/__tests__/platformIdentity.test.ts`
- Modify: `api/functions/src/index.ts`
- Create: `client/src/services/platformSession.ts`
- Create: `client/src/services/__tests__/platformSession.test.ts`
- Modify: `client/src/providers/AuthProvider.tsx`
- Modify: `client/src/services/apiService.tsx`
- Delete: `client/src/services/AuthUIService.tsx`

- [ ] Test Steam/Itch/direct identity normalization, canonical mapping, provider validation errors, and token-cache retry behavior.
- [ ] Run tests and observe the missing session behavior.
- [ ] Implement the server session/link endpoints with injected provider validators and Firebase custom tokens.
- [ ] Implement desktop silent sign-in and cached ID-token requests.
- [ ] Remove Google/email/FirebaseUI usage after the platform/direct session path is connected.
- [ ] Run client typecheck, Functions build, and focused tests; commit.

### Task 5: Harden and slim Electron

**Files:**
- Modify: `client/electron.js`
- Modify: `client/preload.js`
- Modify: `client/package.json`
- Modify: `client/webpack.config.js`
- Modify: `client/src/index.html`
- Create: `client/electron/protocol.js`
- Create: `client/electron/security.js`
- Create: `client/electron/platform.js`
- Create: `client/electron/__tests__/security.test.js`

- [ ] Test protocol path resolution, navigation allowlisting, and IPC sender validation.
- [ ] Confirm tests fail against the localhost server shell.
- [ ] Replace Express with `app://`, add a single-instance lock, sandbox/CSP/navigation rules, and minimal validated IPC.
- [ ] Keep LogRocket while removing Hotjar and Sentry Replay.
- [ ] Remove broad `node_modules`, unpack, duplicate public-copy, and shipped-source-map rules; upgrade Electron/build tooling to supported versions.
- [ ] Run tests, client build, typecheck, and directory packaging; inspect packaged file contents; commit.

### Task 6: Remove browser and blockchain product paths

**Files:**
- Modify: `client/src/app.tsx`
- Modify: `client/src/routes/Root.tsx`
- Delete: `client/src/routes/LandingPage.tsx`
- Delete: `client/src/routes/LandingPage.style.css`
- Delete: `client/src/components/ElysiumPage.tsx`
- Delete: `client/src/components/ElysiumPage.style.css`
- Delete: `client/src/providers/WalletContextProvider.tsx`
- Modify: `client/src/components/playModes/PlayModes.tsx`
- Modify: `shared/config.ts`
- Modify: `client/package.json`
- Delete: `.github/workflows/deploy-client.yml`
- Delete: `.github/workflows/deploy-preview.yml`
- Modify: `firebase.json`

- [ ] Add route and dependency checks for a desktop-only entry point and absence of wallet code.
- [ ] Observe those checks fail.
- [ ] Remove browser landing/acquisition, wallet/Elysium/STAKED paths and dependencies while retaining LogRocket.
- [ ] Remove Firebase Hosting automation and configuration.
- [ ] Run client tests, typecheck, and production build; commit.

### Task 7: Realtime authentication, reconnect, cleanup, and idempotency

**Files:**
- Modify: `matchmaker/src/matchmaker.ts`
- Modify: `matchmaker/src/matchmaking.ts`
- Modify: `matchmaker/test/matchmaking.test.ts`
- Modify: `server/src/server.ts`
- Modify: `server/src/Game.ts`
- Create: `server/src/gameRegistry.ts`
- Create: `server/src/__tests__/gameRegistry.test.ts`
- Modify: `client/src/game/Arena.ts`
- Modify: `client/src/routes/GamePage.tsx`
- Modify: `client/src/game/game.ts`
- Create: `client/src/services/reconnectPolicy.ts`
- Create: `client/src/services/__tests__/reconnectPolicy.test.ts`
- Modify: `.github/workflows/deploy-matchmaker.yml`
- Modify: `.github/workflows/deploy-server.yml`

- [ ] Test the mode comparison defect, authenticated handler ordering, reconnect grace policy, game eviction, and result idempotency.
- [ ] Confirm focused tests fail.
- [ ] Gate Socket.IO connections with Firebase Admin middleware and fix the mode comparison without changing fake queue behavior.
- [ ] Warm the game service on queue entry and configure 60-minute Cloud Run timeouts.
- [ ] Preserve the Phaser game during reconnect, clear only owned timers, and destroy only the owned game instance.
- [ ] Evict completed games and make result application idempotent by `(gameId, uid)`.
- [ ] Run all realtime/client tests and builds; commit.

### Task 8: Desktop input, display, and settings

**Files:**
- Create: `client/src/input/actions.ts`
- Create: `client/src/input/gamepad.ts`
- Create: `client/src/input/__tests__/actions.test.ts`
- Modify: `client/src/game/game.ts`
- Modify: `client/src/components/settingsModal/SettingsModal.tsx`
- Modify: `client/src/components/utils.ts`
- Modify: `client/src/style/style.css`
- Modify relevant menu components to use semantic focusable controls.

- [ ] Test keyboard/gamepad action mapping, disconnect handling, and corrupt settings fallback.
- [ ] Confirm tests fail before implementation.
- [ ] Add the minimal shared action layer and menu focus behavior.
- [ ] Change Phaser scaling to `FIT`, add 16:10 safe-area layout, and persist display settings.
- [ ] Run client tests, typecheck, and build; manually exercise keyboard and synthetic gamepad events; commit.

### Task 9: Store-native build and release automation

**Files:**
- Create: `client/.itch.toml`
- Create: `.github/workflows/release-desktop.yml`
- Modify: `STEAM_DEPLOYMENT.md`
- Delete: `tools/legacy_deployment/deploy_steam.sh`
- Modify: `client/package.json`

- [ ] Add static validation for platform channels, manifest actions/scopes, signing inputs, and absence of plaintext password arguments.
- [ ] Confirm validation fails against the legacy script.
- [ ] Add native OS build matrix, packaged smoke checks, signed artifact hooks, Steam private-branch upload inputs, and Butler validation/upload channels.
- [ ] Keep promotion manual and document required repository/environment secrets.
- [ ] Validate workflow syntax and package configuration; commit.

### Task 10: Consolidated verification and release-size report

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `docs/desktop-release-checklist.md`

- [ ] Add client tests, server build, matchmaker build/tests, Functions lint/build, and Electron security/package checks to CI.
- [ ] Run every local test, lint, typecheck, production build, and Electron directory package command available on the host.
- [ ] Inspect the packaged application for tracked secrets, duplicate assets, source maps, and unexpected production dependencies.
- [ ] Record before/after artifact sizes and platform checks.
- [ ] Verify fake queue numbers, synthetic players/ranking, and LogRocket remain.
- [ ] Review the final diff against every requirement and commit the verification documentation.
