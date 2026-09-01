# Desktop release checklist

Last local verification: 2026-09-01 on `codex/steam-itch-desktop-overhaul` (macOS arm64).

## Automated checks

- [x] Client: 8 suites, 16 tests; TypeScript check; production Electron bundle.
- [x] Electron shell: protocol traversal, trusted IPC/navigation, Steam/Itch session, native gamepad keyboard, and direct-session fallback tests.
- [x] Server: 6 suites, 115 tests; TypeScript build.
- [x] Matchmaker: 4 files, 7 tests; TypeScript build.
- [x] Functions: lint with 0 errors (56 existing warnings), 16 tests, webpack build.
- [x] Release definitions: `actionlint`, JSON parsing, release policy script, and official Butler validation.

## Packaged application

- [x] macOS arm64 directory package: 421 MB; `app.asar`: 123 MB; Steamworks resources: 9.9 MB.
- [x] macOS universal package: 641 MB, verified x86_64 + arm64, launched and remained healthy for a 10-second smoke test.
- [x] Windows x64 directory package: 507 MB; expected `Legion.exe` generated.
- [x] Linux x64 directory package: 415 MB; expected `Legion` executable generated.
- [x] Butler fully validates Windows, macOS, and Linux build directories and the `profile:me` action.
- [x] Package contains no source maps, tracked secrets, broad `node_modules`, or duplicate public asset tree.
- [x] Single-instance lock, sandbox, context isolation, CSP, navigation allowlist, and sender-validated IPC are enabled.

The comparable local macOS arm64 package fell from 694 MB before the desktop cleanup to 421 MB, a 39% reduction. The 641 MB universal build is larger because it contains both macOS architectures.

## Preserved product behavior

- [x] Fake queue numbers remain enabled and regression-tested.
- [x] Synthetic/fake players and fake league ranking remain enabled and regression-tested.
- [x] LogRocket remains enabled and regression-tested; Hotjar and Sentry Replay are removed.
- [x] Friend challenges remain; wager/blockchain paths are removed.

## Store and hardware gates

- [ ] Tagged CI build is signed with Authenticode and Developer ID, then notarized by Apple.
- [ ] Install the Itch `windows`, `mac`, and `linux` channels through the Itch app and verify platform authentication.
- [ ] Upload to a private Steam beta and verify Steam ticket authentication on Windows, macOS, and Steam Deck.
- [ ] On each store build: create/join matchmaking, complete a match, reconnect after a transport drop, and confirm rewards are applied once.
- [ ] On Steam Deck/controller: navigate menus, confirm/cancel, switch units, pass turn, open the game menu, enter text with the Steam keyboard, toggle fullscreen, and exit cleanly.
- [ ] Promote the tested Steam Build ID manually; never automate the default-branch promotion.

The unchecked gates require repository signing/store credentials and real launcher/hardware sessions. CI is configured to fail tagged releases without signing credentials and to smoke-test all three native packages before any optional store upload.
