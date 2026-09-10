const Sentry = require('@sentry/electron/main');
const {anrIntegration} = require('@sentry/node');
const {dsn, dataCollection} = require('./telemetry-options');
const {version} = require('../package.json');

function initializeTelemetry(app) {
  if (!app.isPackaged && process.env.NODE_ENV !== 'production') return;
  Sentry.init({
    dsn,
    release: `legion@${version}`,
    environment: 'production',
    dataCollection,
    maxBreadcrumbs: 30,
    attachScreenshot: false,
    integrations: [
      Sentry.captureConsoleIntegration({levels: ['error']}),
      Sentry.childProcessIntegration({events: ['crashed', 'oom', 'abnormal-exit', 'launch-failed', 'integrity-failure']}),
      Sentry.rendererEventLoopBlockIntegration({captureNativeStacktrace: true}),
      // No profiler/native addon or debugger overhead for the mostly-idle main thread.
      anrIntegration({anrThreshold: 10000, pollInterval: 1000, captureStackTrace: false}),
    ],
  });
}

module.exports = {initializeTelemetry};
