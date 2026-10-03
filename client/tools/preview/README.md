# Guided practice preview

A playable first match using the real client, combat rules, AI, and readiness handshake, with a fresh local roster. No login is needed and no live account data is read or written. Reloading starts a new match. Menu/account screens use the existing guide fixtures; this preview is for combat onboarding.

From the repository root, start these in separate terminals:

```sh
(cd server && bun tools/practice-preview.ts)
(cd client && node tools/preview/practice.cjs)
```

Open **http://127.0.0.1:8082/game/practice-preview**. The web server proxies its combat socket to port 8093. Both servers bind to loopback only. Stop both processes with Ctrl+C when finished.

Reveal the three champions, choose **Start guided match** or **Play without tips**, and play normally. Try an out-of-range move, a spell target, cancellation with Escape, and the **Hide tips / Combat tips** control. Settings supports larger text for checking the coaching panel at small window sizes.

With both servers running, `cd client && node tools/preview/check.cjs` runs a hidden Electron smoke check and saves screenshots under `build/guided-practice/en`. Pass `--locale=ja` (or any folder name from `client/locales/`) to run the same flow in another language. It covers accepted movement and spell progression, rejected targets, cancellation, hide/reopen, and layout at 1280×720 plus 960×540 at 130% text size, including localized introductions, spell guidance, invalid-target feedback, and dock highlights. It requires an environment able to launch Electron; on Linux use Xvfb.

These providers, preview server, and checks are development tools. The release webpack configuration never imports them. The preview blocks external requests and overrides every combat persistence method.
