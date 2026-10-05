# Guided practice preview

A playable first match using the real client, combat rules, AI, and readiness handshake, with a fresh local roster. No login is needed and no live account data is read or written. Reloading starts a new match. Menu/account screens use the existing guide fixtures; this preview is for combat onboarding.

From the repository root, start these in separate terminals:

```sh
(cd server && bun tools/practice-preview.ts)
(cd client && node tools/preview/practice.cjs)
```

Open **http://127.0.0.1:8082/game/practice-preview**. The web server proxies its combat socket to port 8093. Both servers bind to loopback only. Stop both processes with Ctrl+C when finished.

The three champions appear together. Choose whether to enable **Combat tips**, then **Start battle**. Try an out-of-range move, a spell target, cancellation by selecting the spell again, and the **Hide combat tips / Combat tips** control. Escape opens the give-up confirmation. Settings supports larger text for checking the coaching panel at small window sizes.

With both servers running, `cd client && node tools/preview/check.cjs` runs a hidden Electron smoke check and saves screenshots under `build/guided-practice/en`. Pass `--locale=ja` (or any folder name from `client/locales/`) to run the same flow in another language. It covers accepted movement and spell progression, rejected targets, cancellation, hide/reopen, and layout at 1280×720 plus 960×540 at 130% text size, including localized introductions, spell guidance, invalid-target feedback, and dock highlights. It requires an environment able to launch Electron; on Linux use Xvfb.

These providers, preview server, and checks are development tools. The release webpack configuration never imports them. The preview blocks external requests and overrides every combat persistence method.

For the packaged opening and saved tips preference, run `cd client && bun run test:guide --tutorial`. Add `--locale=de`, `--locale=ja`, or another catalog code to inspect translated screens. This uses local fixtures and captures the opening at 1280×720, 800×600 and 960×540, including 130% text size.
