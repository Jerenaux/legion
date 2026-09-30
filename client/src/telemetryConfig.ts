export const telemetryConfig = {
  hotjar: false,
  sentryReplay: process.env.NODE_ENV === 'production' && process.env.SENTRY_REPLAY_ENABLED === 'true',
} as const;
