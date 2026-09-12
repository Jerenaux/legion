const Sentry = require('@sentry/electron/main');
const {anrIntegration} = require('@sentry/node');
const {dsn, dataCollection} = require('./telemetry-options');
const {version} = require('../package.json');
const fs = require('node:fs');
const path = require('node:path');

function filterDesktopEvent(event) {
  const crash = event.contexts?.electron;
  if (crash?.['crashpad.S-A'] === 'Valve') return null;
  // Electron 44's ASAR stat adapter emits this warning; it is not an app failure.
  if (event.logger === 'console' && /^\(node:\d+\) \[DEP0180\] DeprecationWarning: fs\.Stats constructor is deprecated\./.test(event.message || '')) return null;
  return event;
}

function initializeTelemetry(app) {
  if (!app.isPackaged && process.env.NODE_ENV !== 'production') return;
  // Never scan/migrate the inherited crash directory: it can contain Steam dumps.
  const crashDirectory = path.join(app.getPath('userData'), 'legion-crashpad');
  fs.mkdirSync(crashDirectory, {recursive: true});
  app.setPath('crashDumps', crashDirectory);
  Sentry.init({
    dsn,
    enabled: !process.argv.includes('--smoke-test'),
    release: `legion@${version}`,
    environment: 'production',
    dataCollection,
    maxBreadcrumbs: 30,
    attachScreenshot: false,
    beforeSend: filterDesktopEvent,
    integrations: [
      Sentry.captureConsoleIntegration({levels: ['error']}),
      Sentry.childProcessIntegration({events: ['crashed', 'oom', 'abnormal-exit', 'launch-failed', 'integrity-failure']}),
      Sentry.rendererEventLoopBlockIntegration({captureNativeStacktrace: true}),
      // No profiler/native addon or debugger overhead for the mostly-idle main thread.
      anrIntegration({anrThreshold: 10000, pollInterval: 1000, captureStackTrace: false}),
    ],
  });
}

module.exports = {initializeTelemetry, filterDesktopEvent};
