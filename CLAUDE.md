# Repository instructions

Follow `AGENTS.md` for the full repository instructions.

## Testing policy

Do not use test-driven development (TDD), write unit tests, or restore the removed unit-test suites. Implement the change first, then validate it through the smallest relevant integration, end-to-end, smoke, or deployment-contract check.

Tests must exercise interactions between real production components or an actual system boundary: HTTP/Socket.IO, Firestore emulators, native libraries, a packaged app, a browser, or a CLI process. Mock external services or control time when needed for an integration scenario; do not replace the collaborating game logic with mocks and call it an integration test. Do not add isolated helper/class/component tests, even for regressions or security fixes; cover those behaviors through an appropriate integrated flow instead.

Keep the existing integration and smoke suites, lint, type checks, and build checks. Do not add tests solely for presentation or exact player-facing wording. See `docs/testing.md` for the retained suites and commands. This policy supersedes test-first instructions in historical plans and generic skill workflows.

