// import * as Sentry from "@sentry/node";
// import { nodeProfilingIntegration } from "@sentry/profiling-node";

// // Ensure to call this before requiring any other modules!
// Sentry.init({
//   dsn: "https://c3c72f4dedb26b85b58c0eb82feea9c1@o4508024644567040.ingest.de.sentry.io/4508024701452368",
//   integrations: [
//     // Add our Profiling integration
//     nodeProfilingIntegration(),
//     Sentry.captureConsoleIntegration({
//       levels: ['error']
//     }),
//   ],

//   // Add Tracing by setting tracesSampleRate
//   // We recommend adjusting this value in production
//   tracesSampleRate: 1.0,

//   // Set sampling rate for profiling
//   // This is relative to tracesSampleRate
//   profilesSampleRate: 1.0,
// });

// console.log("Sentry initialized");