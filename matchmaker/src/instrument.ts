import * as Sentry from '@sentry/bun';
import {backendTelemetryOptions} from '@legion/shared/telemetry';

Sentry.init({...backendTelemetryOptions,
  initialScope: {tags: {service: 'matchmaker'}},
  integrations: [Sentry.captureConsoleIntegration({levels: ['error']}),
    Sentry.onUnhandledRejectionIntegration({mode: 'strict'})],
});
