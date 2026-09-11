import type LogRocket from 'logrocket';

export const telemetryConfig = {
  logRocket: true,
  hotjar: false,
  sentryReplay: false,
} as const;

function sanitizeURL(value: string): string {
  try {
    const url = new URL(value);
    url.username = url.password = url.search = url.hash = '';
    return url.toString();
  } catch {
    return '[Filtered]';
  }
}

export const logRocketOptions: NonNullable<Parameters<typeof LogRocket.init>[1]> = {
  release: process.env.SENTRY_RELEASE,
  shouldCaptureIP: false,
  dom: {inputSanitizer: true},
  // Sentry handles scrubbed errors/console logs; do not send a second unsanitized copy.
  console: {isEnabled: false},
  shouldDetectExceptions: false,
  browser: {urlSanitizer: sanitizeURL},
  network: {
    requestSanitizer: request => ({...request, url: sanitizeURL(request.url), headers: {}, body: undefined, referrer: undefined}),
    responseSanitizer: response => ({...response, url: response.url ? sanitizeURL(response.url) : undefined, headers: {}, body: undefined}),
  },
};
