import { test, expect } from 'bun:test';
import { telemetryConfig } from "../telemetryConfig";
import {scrubTelemetry} from '../../../shared/telemetryPrivacy';

test("keeps LogRocket while disabling browser session capture", () => {
  expect(telemetryConfig.logRocket).toBe(true);
  expect(telemetryConfig.hotjar).toBe(false);
  expect(telemetryConfig.sentryReplay).toBe(false);
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
