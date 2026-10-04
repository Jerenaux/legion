import {getElectronAPI} from './utils/electronUtils';

const desktop = getElectronAPI();

export const telemetryConfig = {
  hotjar: false,
  sentryReplay: process.env.NODE_ENV === 'production'
    && process.env.BUILD_TARGET === 'electron'
    && process.env.SENTRY_REPLAY_ENABLED === 'true'
    && desktop?.isPackaged === true
    && !desktop.smokeTest
    && window.location.protocol === 'app:'
    && window.location.host === 'legion',
} as const;

function sanitizeURL(value: string): string {
  try {
    const url = new URL(value, window.location.href);
    url.username = url.password = url.search = url.hash = '';
    return url.toString();
  } catch { return '[Filtered]'; }
}

export const logRocketOptions: NonNullable<Parameters<typeof import('logrocket').init>[1]> = {
  release: process.env.SENTRY_RELEASE,
  shouldCaptureIP: false,
  dom: {textSanitizer: false, inputSanitizer: false, imageSanitizer: false},
  // Sentry owns scrubbed errors; never send a second, unsanitized console/exception copy.
  console: {isEnabled: false},
  shouldDetectExceptions: false,
  browser: {urlSanitizer: sanitizeURL},
  network: {
    requestSanitizer: request => ({...request, url: sanitizeURL(request.url), headers: {}, body: undefined, referrer: undefined}),
    responseSanitizer: response => ({...response, url: response.url ? sanitizeURL(response.url) : undefined, headers: {}, body: undefined}),
  },
};
