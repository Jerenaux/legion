# Guided practice preview

A playable first match using the real client, combat rules, AI, and readiness handshake, with a fresh local roster. No login is needed and no live account data is read or written. Reloading starts a new match. Menu/account screens use the existing guide fixtures; this preview is for combat onboarding.

From the repository root, start these in separate terminals:

```sh
(cd server && bun tools/practice-preview.ts)
(cd client && node tools/preview/practice.cjs)
```

Open **http://127.0.0.1:8082/game/practice-preview**. The web server proxies its combat socket to port 8093. Both servers bind to loopback only. Stop both processes with Ctrl+C when finished.

The three champions appear together. Choose whether to enable **Combat tips**, then **Start battle**. A three-step illustrated briefing appears over the arena before combat begins; use Next/Back or Skip tutorial. The match clock waits for dismissal, and reconnecting to a running match does not repeat it. Try an out-of-range move, a spell target, cancellation by selecting the spell again, and the **Hide combat tips / Combat tips** control. Escape opens the give-up confirmation. Settings supports larger text for checking the coaching panel at small window sizes.

With both servers running, `cd client && node tools/preview/check.cjs` runs a hidden Electron smoke check and saves screenshots under `build/guided-practice/en`. Pass `--locale=ja` (or any folder name from `client/locales/`) to run the same flow in another language. It covers accepted movement and spell progression, rejected targets, cancellation, hide/reopen, and layout at 1280×720 plus 960×540 at 130% text size, including localized introductions, contextual spell/item and hazard guidance, invalid-target feedback, and dock highlights. It requires an environment able to launch Electron; on Linux use Xvfb.

These providers, preview server, and checks are development tools. The release webpack configuration never imports them. The preview blocks external requests and overrides every combat persistence method.

For the packaged opening and saved tips preference, run `cd client && bun run test:guide --tutorial`. Add `--locale=de`, `--locale=ja`, or another catalog code to inspect translated screens. This uses local fixtures and captures the opening at 1280×720, 800×600 and 960×540, including 130% text size.

The briefing uses localized action-bar and turn-order crops from `public/guide/`.
Its text-free movement and Fire illustrations live in `public/tutorial/` and are
shared by every language. They were captured from this real practice preview at
1280×720 (crop x=340, y=240, width=550, height=250): the opening Warrior's movement
range, then Fire cast onto empty tile (7,6) during the Black Mage's turn. Capture
after the effect settles; do not resize or paint over the game.
