# Error reporting

Production desktop builds initialize Sentry before application code: `client/electron/telemetry.js` in the main process and `client/src/telemetry.ts` in the renderer. Keep `@sentry/react` and `@sentry/node` on the exact JavaScript SDK version used by `@sentry/electron`.

Coverage includes uncaught JavaScript errors, unhandled promise rejections, `console.error`, native Electron crashes, abnormal child-process exits/OOM, and event-loop freezes over 10 seconds. Renderer freezes include a native JavaScript stack without attaching the debugger. Main-thread freeze reporting avoids a profiler/native addon and reports the stall without a stack. The SDK queues desktop reports offline; a fatal crash may only be uploaded after the next launch. Ordinary window closing is not a crash.

Caught API failures are reported after retries are exhausted, even when the caller only displays a toast. Expected HTTP 4xx rejections are excluded at this boundary. Silent gameplay mistakes cannot be detected automatically: players can use **Menu → Report a problem**. Reports carry the product release and the authenticated player's internal ID when available.

The Bun game server and matchmaker initialize Sentry before other services. Firebase uses the official serverless HTTP wrapper so caught errors inside asynchronous CORS callbacks are flushed before the response ends. Scheduled handlers flush before finishing and rethrow errors to preserve retries. Always import `onRequest`/`onSchedule` from `api/functions/src/telemetry.ts`, not directly from Firebase. Deployment options and weekly league behavior must stay unchanged.

## CI credentials and source maps

Firebase's `firebase.json` predeploy hook is the **only** deployment build. Pass `SENTRY_AUTH_TOKEN` and `SENTRY_BACKEND_PROJECT` to the Firebase deploy step itself. Never build/upload first and then let a credential-less predeploy rebuild replace the instrumented files. `api/functions/src/__tests__/deployment.test.ts` guards this sequencing. Verify a deployed bundle's debug ID against its uploaded map, not just a synthetic event made from an earlier local build.

Keep the unminified Firebase production build on Webpack's `source-map`, not `hidden-source-map`. Bundled dependencies retain their own map comments; without the final bundle map URL, Sentry can associate the entire API with a dependency's map. CI checks the actual output's final map reference. These server-side maps are not served by Firebase Hosting.

- Repository secret `SENTRY_AUTH_TOKEN`: organization-scoped CI token for `dynetis-games`, with `org:ci` permission for source maps and releases. Dashboard verification uses a separate authenticated session, not a broader CI token. Never put this token in the client bundle, Docker build arguments, or a committed env file.
- Repository variable `SENTRY_BACKEND_PROJECT`: `legion-backend` (project ID `4512060848078928`). Desktop project: `legion-desktop` (ID `4512060847947856`). DSNs are public ingestion keys, not upload credentials.
- Open [Legion Desktop](https://dynetis-games.sentry.io/issues/?project=4512060847947856) or [Legion Backend](https://dynetis-games.sentry.io/issues/?project=4512060848078928). Select the **Dynetis Games** organization if Sentry initially opens another workspace. The former projects no longer exist; do not restore their old DSNs.
- All releases are named `legion@<client/package.json version>`. Backend Cloud Run services receive this value at deployment; Firebase and renderer builds embed it.
- The webpack plugins upload source maps for the exact renderer/Firebase bundles. Container builds inject debug IDs before packaging; deploy jobs extract and upload those exact files before rolling out the image. Upload failures stop deployment/release.
- Desktop archives exclude all source maps. Only the SDK's production dependencies are shipped alongside the bundled game; Firebase/Phaser build dependencies must not be included as runtime `node_modules`.

Desktop releases remain manual and main-only. Merging this setup does not update existing Itch/Steam installations; the next requested desktop release does.

### Renderer freeze source maps

Electron's native ANR stacks are captured in the main process. They contain `app://legion/bundle.js` locations but do not carry the renderer's debug IDs. Keep both the modern debug-ID upload and `release.uploadLegacySourcemaps` with `urlPrefix: 'app://legion'` and source-map headers enabled. Use the build platform (`darwin`, `win32`, or `linux`) as Sentry `dist` in the uploader and both SDK processes, so simultaneous platform builds cannot overwrite each other's legacy maps. The latter associates these frames with the exact product release and platform; it is not permission to publish maps in the app. Upload failures must remain fatal.

`bun run test:guide` deliberately freezes its local renderer and resolves the resulting native ANR frame through the production-format hidden source map to the fixture's TypeScript. It also crashes and reloads the renderer into the same match, using a test response to the real recovery handler. All envelopes stay on loopback. Release verification must additionally check a newly uploaded release's frame resolution in Sentry; a local map check alone cannot prove successful server-side artifact association.

### Combat lifecycle and memory

`GamePage` owns the entire Phaser game and must destroy it when its route unmounts. Stopping `Arena` alone leaves textures, audio, render loops, and WebGL contexts alive. `stopGame` completes Phaser's pending destruction after the current call stack, without depending on another animation frame (hidden windows can stop those). Arena teardown is idempotent, disconnects its socket and removes only its own listeners; Phaser owns display-object destruction. Delayed combat callbacks must use the scene clock, never browser `setTimeout`, so shutdown cancels them. Speech-bubble layout frames must also be cancelled when their objects are destroyed. A replacement server snapshot or direct match-ID switch reloads that match URL rather than stacking another match's objects into the old scene.

The large spell sheets use 256-pixel frames with compensated display scaling. Preserve frame count, duration, and on-screen dimensions when changing these assets. Image loading is limited to four parallel requests to reduce decode/upload bursts. Do not reintroduce 4096-pixel sheets without measuring memory on low-end Windows hardware.

Load only the snapshot's character sprites and spell effects, not the entire catalog. Opponent spells remain private: their effects load when a cast arrives, before processing that event or later events. Summons and replay events use the same ordered queue. Keep the queue bounded and clear it on teardown. Never process updates before the initial snapshot has created the teams and units. Validate asset names against the shipped catalogs. No server protocol change or full enemy loadout is needed.

Music retains the current track and prefetches its next transition (with the first loop retained as an intro fallback). Completed sound objects and unused decoded tracks are released. Preserve health-driven jumps, two-play progression, bridge timing, and volume settings. The same packaged fixture measured approximately **129 MiB of decoded textures + 21 MiB of decoded audio**, versus **538 + 82 MiB** before selective loading. These are decoded asset estimates, not total process RSS, GPU-driver allocation, or a guarantee for every loadout. CI budgets the fixture below 200 MiB textures and 35 MiB audio and checks late enemy spells and summoned sprites.

The native renderer is preferred; a Canvas renderer is available when WebGL context creation fails. JavaScript render failures and context loss offer a reload/reconnect screen, while a terminated Electron renderer offers a native reload/close dialog. These are recovery paths, not a guarantee against GPU-driver failures or insufficient system memory. CI runs repeated-match, interrupted-loading, teardown, and recovery checks on Linux, Windows, and macOS. It does not emulate every player's GPU.

Authentication rejection, malformed match messages, asset failures, unhandled rejections, and a missing snapshot must reach the same recovery screen. Loading and reconnection have a 30-second deadline, not just a console warning. Electron also offers recovery for an unresponsive renderer or failed main-frame navigation. The HTML entry contains a script-independent reload fallback for missing bundles and exceptions before Preact mounts; keep it compatible with the existing CSP. `test:guide` uses a real loopback Socket.IO server for these failures; install both client and server dependencies before running it. Test-only connection overrides remain in fixtures, which must never enter a release bundle.

Server startup is guarded before its first asynchronous operation. Repeated joins for the same authenticated UID replace that player's socket, never consume another team slot. A superseded socket cannot clear the replacement on disconnect. Keep the AI and PvP lifecycle regression tests when changing connection setup.

## Privacy and cost

Set Electron's `crashDumps` path to `userData/legion-crashpad` **before** initializing Sentry. Do not scan, migrate or delete the inherited/default crash directory: old reports there can belong to Steam. Valve-identified minidumps are also rejected by the desktop event filter. Native dumps can contain process memory, so metadata scrubbing alone does not make collecting another application's dump safe.

Only the exact Electron `DEP0180` / `fs.Stats` console deprecation is suppressed. Real exceptions, other warnings, OOM and renderer crashes remain reportable. Firebase's `AuthenticationError` distinguishes missing/malformed/expired credentials from verifier outages; only the former is excluded from Sentry. Never suppress every `auth/*` error or every HTTP 401, as callers may misclassify a real outage.

The game server and matchmaker share the desktop-origin policy. Disallowed origins receive HTTP 403 (Engine.IO uses HTTP 400 for denied WebSocket upgrades), without throwing into error reporting. Keep direct WebSocket validation and Firebase token authentication; CORS alone is not authentication. Production Hosting serves a standalone promotional page, never the old browser game.

For Sentry, disable automatic HTTP bodies, headers, cookies, URL query parameters, local variables, names/emails, and feedback screenshots. Shared scrubbing also removes credential-shaped fields, query strings, and JWTs from renderer/backend event text. Don't log credentials: no scrubber can recognize arbitrary private text, and native minidumps can contain process memory. The report form asks for no name/email and warns players against including private information. Replay privacy controls are described below.

Backend tracing/profiling is off. Existing 10% renderer performance sampling is retained; errors are not sampled away. As verified on 2026-09-10, the organization uses the free Developer plan with a shared 5,000-error allowance and no on-demand spending. No paid plan or billing change was made. Check **Settings → Subscription / Usage** before relying on coverage at higher volume: exhausted quotas can discard reports, and retention depends on the plan.

Both projects enable server-side sensitive-data and IP-address scrubbing. Their default email rules notify issue owners (falling back to active members) for new or escalated high-priority issues, not every error. Email delivery itself has not been verified. An HTTP 200 from ingestion alone does not prove an event was stored or an alert delivered.

## Verification

Run `bun run lint`, the four services' test/type checks, and `bun run test:guide` from `client`. The guide smoke test is muted, uses local fixtures only, exercises the real SDK transport, and runs in CI. Do not send deliberate production exceptions through live gameplay endpoints. For account-level verification, send a clearly tagged event in the `verification` environment and confirm its receipt/release/source context in Sentry; do not claim dashboard delivery based only on an accepted envelope.

Native packages support `Legion --smoke-test`: an isolated temporary profile, muted/hidden window, disabled Sentry, blocked remote renderer requests, no Steam authentication, and normal window close after the real `app://legion/` offline-recovery screen renders. A fresh offline profile cannot reach the authenticated title; the guide harness separately checks that full flow. CI and release workflows run this instead of killing the executable after ten seconds. This startup check complements, not replaces, the guide harness's fixture gameplay and real-SDK loopback/crash tests. Never mark synthetic CI sessions as production or send CI recordings to live ingestion.

The September 2026 setup was verified with tagged synthetic exceptions in both projects: `legion@0.5.3` reports were stored and their uploaded desktop/Firebase source maps resolved compiled stack locations to the original TypeScript source. These are setup checks, not player failures. Future project migrations must repeat this check and update both ingestion DSNs and upload destinations together.

## Sentry desktop replays

Sentry is the sole session recorder. LogRocket was removed in v0.5.11, including its SDK, identity calls, and remote script permission. `PACKAGED_CSP` permits only bundled scripts; local/blob workers remain required for Sentry Replay.

Only the manual Steam/Itch desktop release workflow sets `SENTRY_REPLAY_ENABLED=true` when bundling the renderer. Local development and locally packaged production builds default to Replay off; `--smoke-test` also disables Sentry. Store renderer sessions use `replaysSessionSampleRate: 1` (100% of sessions), including sessions without errors. `replaysOnErrorSampleRate: 0` avoids a separate error-only buffering mode. This does not change the existing trace sampling rate. The account's replay quota limits accepted recordings; there is no client-side 50-session counter, paid upgrade, or spending change. Once the quota is exhausted, recordings can be discarded until it renews.

The existing Sentry SDK records the Phaser WebGL canvas through `replayCanvasIntegration` in manual snapshot mode. Phaser's `POST_RENDER` event captures pixels before the buffer clears; the SDK limits capture to 2 fps. Keep `preserveDrawingBuffer` disabled and capture failures isolated from gameplay. These are low-frame-rate recordings, not smooth video.

Replay records DOM text, ordinary input values, and media. Password-type inputs remain masked by Sentry's recorder. Players can still type private information into ordinary fields, including feedback; this content is visible in replays and cannot be scrubbed after capture. Network bodies and detailed headers are not collected, and custom recording events pass through the shared credential/URL scrubber. Canvas pixels cannot be scrubbed: do not render passwords, chat, or other sensitive information into the arena. Private `app://` fonts and images outside the canvas remain a playback limitation in Sentry's web player; no public asset mirror is configured.

`bun run test:guide` verifies real compressed Replay envelopes through Electron's transport to a loopback sink, including visible DOM text, ordinary inputs and media references, masked passwords, decodable nonblank combat pixels, and network redaction under the production CSP. It never consumes live Sentry quota. This verifies capture and transport, not live dashboard storage or playback.

Reference: [Sentry canvas recording](https://docs.sentry.io/platforms/javascript/session-replay/#canvas-recording).
