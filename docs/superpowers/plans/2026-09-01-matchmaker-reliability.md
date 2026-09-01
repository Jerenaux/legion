# Matchmaker Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make matchmaking passes safe under slow game creation and make new matchmaker images boot on Cloud Run.

**Architecture:** Keep the existing queue and timer. Add one in-process pass guard, make failed game creation advance normally, and pass queue records—not sockets—to the existing removal function. Start the compiled Bun entrypoint directly in the runtime image.

**Tech Stack:** TypeScript, Bun test runner, Docker, Google Cloud Run, GitHub Actions

---

### Task 1: Matchmaking regression

**Files:**
- Create: `matchmaker/test/matchmaking.test.ts`
- Modify: `matchmaker/src/matchmaking.ts`
- Modify: `matchmaker/package.json`
- Modify: `matchmaker/tsconfig.json`

- [ ] **Step 1: Write the failing test**

Add a Bun test that starts a deliberately slow failed match, invokes a second matchmaking pass while the first is pending, and asserts only one game-creation attempt occurs and the queue scan completes. Then run a successful pass and assert both queue records are removed.

- [ ] **Step 2: Run the regression test and verify RED**

Run: `cd matchmaker && bun test test/matchmaking.test.ts`

Expected: FAIL because the guarded pass/testable queue entrypoints do not exist yet.

- [ ] **Step 3: Implement the minimal fix**

In `matchmaking.ts`, add an async pass function with a module-level busy flag reset in `finally`, and call it from the existing interval. Let `tryMatchPlayers` accept its existing queue and game-creation function as defaults so the real algorithm can be tested without Firebase. Set `matchFound` only on success, and call `removePlayerFromQ(player2)` / `removePlayerFromQ(player1)` with queue records.

Add `"test": "bun test test"` to `package.json` and exclude the test directory from the application TypeScript build; no dependency is required.

- [ ] **Step 4: Verify GREEN and build**

Run: `cd matchmaker && bun test test/matchmaking.test.ts && bun run build`

Expected: one passing regression test and a successful TypeScript build.

- [ ] **Step 5: Commit**

Run: `git add matchmaker/test/matchmaking.test.ts matchmaker/src/matchmaking.ts matchmaker/package.json matchmaker/tsconfig.json && git commit -m 'Fix overlapping matchmaking passes'`

### Task 2: Production image startup

**Files:**
- Modify: `matchmaker/Dockerfile.prod`

- [ ] **Step 1: Fix the runtime command**

Replace `CMD ["bun", "run", "start"]` with `CMD ["bun", "dist/src/matchmaker.js"]`; the runtime image does not contain `package.json`.

- [ ] **Step 2: Build and run the production image**

Run: `docker build -f matchmaker/Dockerfile.prod -t legion-matchmaker:test --platform linux/amd64 .`

Run the image with `PORT=8080`, then probe `http://127.0.0.1:<published-port>/`.

Expected: HTTP 200 with `Matchmaking server is running`.

- [ ] **Step 3: Commit**

Run: `git add matchmaker/Dockerfile.prod && git commit -m 'Fix matchmaker container startup'`

### Task 3: Integrate, deploy, and verify

**Files:**
- No additional source files.

- [ ] **Step 1: Verify branch**

Run the regression test, build, `git diff --check`, and inspect the branch diff.

- [ ] **Step 2: Squash merge**

Switch to `main`, run `git merge --squash fix/matchmaker-deploy-and-loop`, commit the squashed change, and push `main` so the existing deploy workflow runs.

- [ ] **Step 3: Confirm deployment**

Watch the GitHub Actions matchmaker workflow and Cloud Run until the new revision is ready and receives 100% of traffic.

- [ ] **Step 4: Confirm production behavior**

Probe HTTP and Socket.IO, repeat the two-player matchmaking/game-server smoke test, remove all test-only Firestore artifacts, restore touched player fields, and inspect logs for startup failures, tight loops, 503s, and restarts.
