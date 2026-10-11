# Repository instructions

Follow `AGENTS.md` for the full repository instructions.

## No TDD and no UI tests

**Never use test-driven development (TDD)** and never write tests first. Implement the change, then verify it.

**Never write UI or frontend tests.** Do not add automated checks of what the interface shows or how it looks or behaves on screen: text, labels, wording, translated strings, number or turn formatting, icons, tooltips, hover cards, dialogs, menus, the combat dock, keyboard/pointer UI flows, layout, sizes, overflow, scrolling, or styling. This applies to new scripts and to new assertions inside existing scripts.

When a UI change breaks an existing UI assertion, **delete the assertion**; do not update, rewrite or replace it with a "behavioral" equivalent. Verify UI work by rebuilding the app and looking at it, with screenshots when useful.

The only client-side automated checks are the existing smoke tests for startup and authentication, packaged routing, error reporting and replay privacy, crash recovery, and match readiness. The guide, localization, gifts, roster, Tower and preview scripts only capture screenshots for manual review.

## Testing policy

Do not write unit tests or restore the removed unit-test suites. Implement the change first, then validate it through the smallest relevant integration, end-to-end, smoke, or deployment-contract check.

Tests must exercise interactions between real production components or an actual system boundary: HTTP/Socket.IO, Firestore emulators, native libraries, a packaged app, a browser, or a CLI process. Mock external services or control time when needed for an integration scenario; do not replace the collaborating game logic with mocks and call it an integration test. Do not add isolated helper/class/component tests, even for regressions or security fixes; cover those behaviors through an appropriate integrated flow instead.

Keep the existing backend integration and smoke suites, lint, type checks, and build checks. Never add UI tests (see above). See `docs/testing.md` for the retained suites and commands. This policy supersedes test-first instructions in historical plans and generic skill workflows.

