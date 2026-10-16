import {startReplay} from '@jerenaux/replay/renderer';
import {t} from './i18n/core';
import * as Sentry from '@sentry/react';
import {init as initElectron, eventLoopBlockIntegration} from '@sentry/electron/renderer';
import {dsn, dataCollection} from '../electron/telemetry-options';
import {scrubTelemetry} from '@legion/shared/telemetryPrivacy';
import {getElectronAPI} from './utils/electronUtils';

export const sessionReplay = startReplay(getElectronAPI()?.replay, id => {
  Sentry.setContext('replay', {sessionId: id, url: `https://games-replay-jr.web.app/#/s/${id}`});
});

if (process.env.NODE_ENV === 'production') {
  const options = {
    enabled: !getElectronAPI()?.smokeTest,
    dsn,
    environment: 'production',
    release: process.env.SENTRY_RELEASE,
    dist: process.env.SENTRY_DIST,
    dataCollection,
    beforeSend: (event: Sentry.ErrorEvent) => {
      sessionReplay.event('error', {type: event.exception?.values?.[0]?.type || 'Error'});
      return scrubTelemetry(event);
    },
    beforeBreadcrumb: scrubTelemetry,
    maxBreadcrumbs: 30,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.captureConsoleIntegration({levels: ['error']}),
      Sentry.feedbackIntegration({
        autoInject: false,
        showName: false,
        showEmail: false,
        enableScreenshot: false,
        colorScheme: 'dark' as const,

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
  const form = await feedback.createForm({
    formTitle: t('Report a problem'),
    messageLabel: t('What went wrong?'),
    messagePlaceholder: t('Describe what happened and what you expected. Do not include passwords or other private information.'),
    submitButtonLabel: t('Send report'),
    cancelButtonLabel: t('Cancel report'),
    isRequiredLabel: t('Required'),
    successMessageText: t('Report sent. Thank you for helping improve Emberhall.'),
    onFormClose: () => form.removeFromDom(),
  });
  form.appendToDom();
  form.open();
}

export {captureException} from '@sentry/react';

let signedInId: string | undefined;

export function setUser(user: Parameters<typeof Sentry.setUser>[0]) {
  Sentry.setUser(user);
  try {
    if (user?.id) {
      signedInId = String(user.id);
      sessionReplay.identify(signedInId);
    } else if (signedInId) {
      // Only a real sign-out starts a new recording. Startup reports "no user" before the
      // platform login completes; splitting there cut the start off every session.
      signedInId = undefined;
      sessionReplay.identify();
    }
  } catch { /* Optional recording must not interrupt authentication. */ }
}

// The main process persists frames independently; also flush errors before closing.
getElectronAPI()?.onTelemetryFlush?.(async () => {
  await Promise.all([Sentry.flush(1200).catch(() => false), sessionReplay.stop()]);
});
