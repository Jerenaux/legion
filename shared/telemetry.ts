import {scrubTelemetry} from './telemetryPrivacy';

// Public ingestion key, not a privileged Sentry auth token.
export const backendTelemetryOptions = {
  dsn: 'https://c3c72f4dedb26b85b58c0eb82feea9c1@o4508024644567040.ingest.de.sentry.io/4508024701452368',
  enabled: process.env.NODE_ENV === 'production' && process.env.FUNCTIONS_EMULATOR !== 'true',
  environment: 'production',
  release: process.env.SENTRY_RELEASE,
  maxBreadcrumbs: 30,
  beforeSend: scrubTelemetry,
  beforeBreadcrumb: scrubTelemetry,
  // Error reporting only: no backend tracing, profiling, replay, or payload collection.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: {request: false, response: false},
    httpBodies: [],
    urlQueryParams: false,
    genAI: {inputs: false, outputs: false},
    stackFrameVariables: false,
  },
};
