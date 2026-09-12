import * as Sentry from '@sentry/react';
import {init as initElectron, eventLoopBlockIntegration} from '@sentry/electron/renderer';
import {dsn, dataCollection} from '../electron/telemetry-options';
import {scrubTelemetry} from '@legion/shared/telemetryPrivacy';
import {getElectronAPI} from './utils/electronUtils';

if (process.env.NODE_ENV === 'production') {
  const options = {
    enabled: !getElectronAPI()?.smokeTest,
    dsn,
    environment: 'production',
    release: process.env.SENTRY_RELEASE,
    dataCollection,
    beforeSend: scrubTelemetry,
    beforeBreadcrumb: scrubTelemetry,
    maxBreadcrumbs: 30,
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.captureConsoleIntegration({levels: ['error']}),
      Sentry.feedbackIntegration({
        autoInject: false,
        showName: false,
        showEmail: false,
        enableScreenshot: false,
        colorScheme: 'dark' as const,
        formTitle: 'Report a problem',
        messageLabel: 'What went wrong?',
        messagePlaceholder: 'Describe what happened and what you expected. Do not include passwords or other private information.',
        submitButtonLabel: 'Send report',
        successMessageText: 'Report sent. Thank you for helping improve Legion.',
      }),
    ],
  };
  if (process.env.BUILD_TARGET === 'electron') {
    initElectron({...options, integrations: [...options.integrations,
      eventLoopBlockIntegration({threshold: 10000, pollInterval: 1000}),
    ]}, Sentry.init);
  } else Sentry.init(options);
}

export async function reportProblem() {
  const feedback = Sentry.getFeedback();
  if (!feedback) throw new Error('Problem reporting is unavailable in this development build.');
  const form = await feedback.createForm({onFormClose: () => form.removeFromDom()});
  form.appendToDom();
  form.open();
}

export {captureException, setUser} from '@sentry/react';
