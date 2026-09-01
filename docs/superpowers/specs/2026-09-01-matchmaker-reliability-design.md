# Matchmaker reliability fix

## Scope

Fix the production matchmaker's overlapping matchmaking passes, failed-match tight loop, and Cloud Run startup failure without changing its public protocol or deployment topology.

## Design

- Allow only one asynchronous matchmaking pass at a time. A slow game-creation request must finish before the next interval can start another pass.
- Mark a pair as matched only when game creation succeeds. On failure, advance to the next queued player instead of reconsidering the same pair indefinitely.
- Start the compiled matchmaker directly from the production container. The runtime image intentionally has no `package.json`, so it must not use `bun run start`.

## Verification

- Add one regression test covering a slow, failed game creation and proving matchmaking passes do not overlap or spin.
- Build the TypeScript project and production container locally; run the image with a Cloud Run-style `PORT` and probe its health endpoint.
- Squash-merge the branch into `main`, deploy through the existing matchmaker workflow, and verify the new Cloud Run revision becomes ready and receives traffic.
- Repeat the two-player production matchmaking/game-server smoke test, clean its test records, and inspect matchmaker logs for restart, tight-loop, and startup errors.
