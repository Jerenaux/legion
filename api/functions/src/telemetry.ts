import * as Sentry from '@sentry/google-cloud-serverless';
import {onRequest as firebaseOnRequest, HttpsOptions, Request} from 'firebase-functions/v2/https';
import {onSchedule as firebaseOnSchedule, ScheduleOptions, ScheduledEvent} from 'firebase-functions/v2/scheduler';
import type {Response} from 'express';
import {backendTelemetryOptions} from '@legion/shared/telemetry';

Sentry.init({...backendTelemetryOptions,
  enabled: backendTelemetryOptions.enabled && Boolean(process.env.K_SERVICE),
  initialScope: {tags: {service: 'firebase-api'}},
  integrations: [Sentry.captureConsoleIntegration({levels: ['error']})],
});

type Handler = (request: Request, response: Response) => void | Promise<void>;
const wrap = (handler: Handler) => Sentry.wrapHttpFunction((request, response) => handler(request as Request, response));
// Wrapping the handler (not the exported function) preserves Firebase's deployment metadata.
// The official HTTP wrapper drains reports before res.end, including async CORS callbacks.
export function onRequest(options: HttpsOptions | Handler, handler?: Handler) {
  return typeof options === 'function'
    ? firebaseOnRequest(wrap(options))
    : firebaseOnRequest(options, wrap(handler!));
}

export function onSchedule(options: ScheduleOptions, handler: (event: ScheduledEvent) => void | Promise<void>) {
  return firebaseOnSchedule(options, event => Sentry.withIsolationScope(async () => {
    try {
      await handler(event);
    } catch (error) {
      Sentry.captureException(error);
      throw error; // Preserve Cloud Scheduler retries.
    } finally {
      await Sentry.flush(2000);
    }
  }));
}

export type {HttpsFunction, HttpsOptions} from 'firebase-functions/v2/https';
