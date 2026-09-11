import { test, expect } from 'bun:test';
import { logRocketOptions, telemetryConfig } from "../telemetryConfig";
import {scrubTelemetry} from '../../../shared/telemetryPrivacy';

test("keeps LogRocket while disabling browser session capture", () => {
  expect(telemetryConfig.logRocket).toBe(true);
  expect(telemetryConfig.hotjar).toBe(false);
  expect(telemetryConfig.sentryReplay).toBe(false);
});

test('LogRocket keeps network diagnostics without recording credentials or private inputs', () => {
  const request = logRocketOptions.network!.requestSanitizer!({reqId: '1', method: 'POST',
    url: 'https://user:private-password@example.test/auth?token=private-token#private-fragment',
    headers: {Authorization: 'private-header'}, body: 'private-body', referrer: 'https://example.test/?private-referrer',
  });
  const response = logRocketOptions.network!.responseSanitizer!({reqId: '1', method: 'POST', status: 401,
    url: 'https://example.test/auth?token=private-token', headers: {'Set-Cookie': 'private-cookie'}, body: 'private-body',
  });
  expect(request?.url).toBe('https://example.test/auth');
  expect(request?.method).toBe('POST');
  expect(response?.status).toBe(401);
  expect(JSON.stringify({request, response})).not.toContain('private-');
  expect(logRocketOptions.browser!.urlSanitizer!('app://legion/play?token=private-token')).toBe('app://legion/play');
  expect(logRocketOptions.browser!.urlSanitizer!('private-invalid-url')).toBe('[Filtered]');
  expect(logRocketOptions.dom?.inputSanitizer).toBe(true);
  expect(logRocketOptions.shouldCaptureIP).toBe(false);
  expect(logRocketOptions.console?.isEnabled).toBe(false);
  expect(logRocketOptions.shouldDetectExceptions).toBe(false);
});

test('redacts telemetry credentials without throwing on complex console arguments', () => {
  const circular: Record<string, unknown> = {count: BigInt(1)};
  circular.self = circular;
  const result = JSON.stringify(scrubTelemetry({circular,
    credential: 'private-credential', accessToken: 'private-token',
    url: 'https://example.test/game?key=private-query#private-fragment',
    message: 'JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature',
  }));
  expect(result).not.toMatch(/private-|eyJ/);
  expect(result).toContain('https://example.test/game');
  expect(result).toContain('[Circular]');
  expect(scrubTelemetry<unknown>({toJSON() {throw new Error('unserializable');}})).toBeNull();
});
