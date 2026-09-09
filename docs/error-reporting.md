# Error reporting

Production desktop builds initialize Sentry before application code: `client/electron/telemetry.js` in the main process and `client/src/telemetry.ts` in the renderer. Keep `@sentry/react` and `@sentry/node` on the exact JavaScript SDK version used by `@sentry/electron`.

Coverage includes uncaught JavaScript errors, unhandled promise rejections, `console.error`, native Electron crashes, abnormal child-process exits/OOM, and event-loop freezes over 10 seconds. Renderer freezes include a native JavaScript stack without attaching the debugger. Main-thread freeze reporting avoids a profiler/native addon and reports the stall without a stack. The SDK queues desktop reports offline; a fatal crash may only be uploaded after the next launch. Ordinary window closing is not a crash.

Caught API failures are reported after retries are exhausted, even when the caller only displays a toast. Expected HTTP 4xx rejections are excluded at this boundary. Silent gameplay mistakes cannot be detected automatically: players can use **Menu → Report a problem**. Reports carry the product release and the authenticated player's internal ID when available.

The Bun game server and matchmaker initialize Sentry before other services. Firebase uses the official serverless HTTP wrapper so caught errors inside asynchronous CORS callbacks are flushed before the response ends. Scheduled handlers flush before finishing and rethrow errors to preserve retries. Always import `onRequest`/`onSchedule` from `api/functions/src/telemetry.ts`, not directly from Firebase. Deployment options and weekly league behavior must stay unchanged.

## CI credentials and source maps

- Repository secret `SENTRY_AUTH_TOKEN`: upload-capable Sentry token for the `dynetis-games` organization. For dashboard verification, it also needs issue/event read access. Never put this token in the client bundle, Docker build arguments, or a committed env file.
- Repository variable `SENTRY_BACKEND_PROJECT`: the existing backend project's slug (project ID `4508024701452368`). Desktop project: `javascript-react` (ID `4508024650268752`). DSNs are public ingestion keys, not upload credentials.
- All releases are named `legion@<client/package.json version>`. Backend Cloud Run services receive this value at deployment; Firebase and renderer builds embed it.
- The webpack plugins upload source maps for the exact renderer/Firebase bundles. Container builds inject debug IDs before packaging; deploy jobs extract and upload those exact files before rolling out the image. Upload failures stop deployment/release.
- Desktop archives exclude all source maps. Only the SDK's production dependencies are shipped alongside the bundled game; Firebase/Phaser build dependencies must not be included as runtime `node_modules`.

Desktop releases remain manual and main-only. Merging this setup does not update existing Itch/Steam installations; the next requested desktop release does.

## Privacy and cost

Disable automatic HTTP bodies, headers, cookies, URL query parameters, local variables, names/emails, screenshots, and replay. Shared scrubbing also removes credential-shaped fields, query strings, and JWTs from renderer/backend event text. Don't log credentials: no scrubber can recognize arbitrary private text, and native minidumps can contain process memory. The report form asks for no name/email and warns players against including private information. Existing LogRocket remains unchanged.

Backend tracing/profiling is off. Existing 10% renderer performance sampling is retained; errors are not sampled away. Sentry's project quota, retention, and issue-alert rules still need to be checked in the Sentry account. An HTTP 200 from ingestion alone does not prove an event was stored or an alert delivered.

## Verification

Run `bun run lint`, the four services' test/type checks, and `bun run test:guide` from `client`. The guide smoke test is muted, uses local fixtures only, exercises the real SDK transport, and runs in CI. Do not send deliberate production exceptions through live gameplay endpoints. For account-level verification, send a clearly tagged event in the `verification` environment and confirm its receipt/release/source context in Sentry; do not claim dashboard delivery based only on an accepted envelope.
