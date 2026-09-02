# Steam and Itch Desktop Overhaul Design

## Goal

Turn Legion into a desktop-first Steam and Itch game without rewriting the Phaser client or TypeScript backend. Preserve the existing fake queue counts, synthetic players, synthetic league ranking behavior, and LogRocket.

## Scope

The implementation removes browser-only product paths and the disabled blockchain experience, hardens Electron and backend trust boundaries, improves realtime recovery, replaces the expensive persisted-rank fan-out with indexed leaderboard reads while retaining synthetic ranking data, adds platform-session plumbing, makes the packaged application smaller, and creates signed-release-ready Steam and Itch workflows.

Production deployment and external credential rotation are not part of this branch: the branch removes tracked secret material and defines runtime secret inputs, but deployment owners must rotate the real credentials before release.

## Desktop shell and packaging

Electron loads packaged renderer content through a privileged `app://` protocol instead of a localhost Express server. The renderer remains isolated and sandboxed, navigation and window creation are allowlisted, IPC senders are validated, and only the minimum platform/fullscreen API is exposed from preload. Production builds exclude runtime-wide `node_modules`, source maps, and duplicate copied assets. Steam and Itch consume unpacked, platform-native build directories; Steam promotion remains manual and Itch uses Butler channels.

Electron stays the shipping wrapper. Tauri and engine/language rewrites are explicitly excluded because they do not address the current reliability, trust-boundary, input, or package-content problems.

## Identity

Firebase Auth remains the internal session-token system, but Google/email/FirebaseUI are removed from the desktop experience. A session HTTP function accepts one of three provider credentials:

- a Steam Web API ticket, validated server-side;
- an Itch session API key, validated against the Itch profile endpoint;
- a direct-download anonymous device identifier.

The function transactionally maps `provider:providerUserId` to a canonical Firebase UID, ensures the player document exists, and returns a Firebase custom token. Steam publisher credentials remain server-only. Existing Firebase users can link a platform identity through an authenticated request. The renderer caches Firebase ID tokens and refreshes after unauthorized responses rather than forcing a refresh for every request.

## Backend trust boundaries

Authentication fails closed. Player endpoints require a Firebase ID token and never accept a fallback UID. Internal game mutations require the existing service API key. Admin/dashboard endpoints require the service API key until an IAP deployment is configured. Health probes use dedicated routes and do not bypass application authentication.

Tracked environment files are removed and ignored. Docker services receive secrets at runtime. Firestore and Storage rules are versioned and direct client writes are denied unless a narrow rule is explicitly required.

## Ranking

Fake and synthetic ranking behavior remains. The expensive persisted exact-rank fan-out does not.

Leaderboard reads query indexed score fields directly with a fixed limit. Active ranked statistics are season-scoped and reset lazily when a player first participates in a new season. League divisions use score thresholds. The response includes numbered positions for the top rows and derives the requesting player's personal position with an aggregation count only when needed. Old rank-trigger exports and the unauthenticated manual rerank endpoint are removed, while the synthetic inactive-player schedule remains exported and its generated players continue to appear through the indexed queries.

## Realtime services

Both Cloud Run services remain single-instance with minimum instances zero. Socket authentication runs as middleware before any handlers. The game service is warmed when a player joins matchmaking. The client reconnects for a bounded grace period rather than destroying the Phaser scene immediately. Completed in-memory games are evicted after that grace period, and post-game updates are idempotent by game ID and player ID. Canonical Firestore game documents use the game ID as the document ID.

Fake queue counts remain enabled and receive a regression test. The matchmaker mode-assignment defect is fixed separately.

## Desktop experience

The client always enters the desktop title flow. Browser landing, acquisition/referrer tracking, Firebase Hosting deployment, Hotjar, and Sentry Replay are removed. LogRocket remains. Sampled Sentry error and performance telemetry remains.

An input action layer supplies menu navigation, confirm, cancel, unit selection, end turn, and pause through keyboard and the Gamepad API. Existing mouse input continues to work. Menus use focusable controls, settings parsing is resilient, the Phaser canvas uses `FIT`, and the HUD respects 16:10 safe areas. Steam-native glyph and on-screen-keyboard calls are exposed through the platform adapter when the Steam binding is available and degrade cleanly elsewhere.

## Verification

The branch must pass server tests, client/matchmaker/API type and build checks, focused security/ranking/reconnect tests, Electron packaged launch smoke tests, and checks that the protected fake systems and LogRocket remain. CI runs builds on supported host operating systems and validates the Itch manifest before upload.
