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

Production renderer sessions enable Replay with `replaysSessionSampleRate: 1` (100% of sessions), including sessions without errors. `replaysOnErrorSampleRate: 0` avoids a separate error-only buffering mode. Development and packaged `--smoke-test` runs do not record. This does not change the existing trace sampling rate. The account's replay quota limits accepted recordings; there is no client-side 50-session counter, paid upgrade, or spending change. Once the quota is exhausted, recordings can be discarded until it renews.

The existing Sentry SDK records the Phaser WebGL canvas through `replayCanvasIntegration` in manual snapshot mode. Phaser's `POST_RENDER` event captures pixels before the buffer clears; the SDK limits capture to 2 fps. Keep `preserveDrawingBuffer` disabled and capture failures isolated from gameplay. These are low-frame-rate recordings, not smooth video.

DOM text and all inputs remain masked; other media is blocked, with only `#scene canvas` unblocked. Network bodies and detailed headers are not collected, and custom recording events pass through the shared credential/URL scrubber. Canvas pixels cannot be scrubbed: do not render passwords, chat, or other sensitive information into the arena. Private `app://` fonts and images outside the canvas remain a playback limitation; no public asset mirror is configured.

`bun run test:guide` verifies real compressed Replay envelopes through Electron's transport to a loopback sink, including DOM snapshots, decodable nonblank combat pixels, and input/network redaction under the production CSP. It never consumes live Sentry quota. This verifies capture and transport, not live dashboard storage or playback.

Reference: [Sentry canvas recording](https://docs.sentry.io/platforms/javascript/session-replay/#canvas-recording).
