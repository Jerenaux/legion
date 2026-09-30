import { test, expect } from 'bun:test';
import {resolve} from 'node:path';
import {scrubTelemetry} from '../../../shared/telemetryPrivacy';

test('records replays only when a production store build opts in', () => {
  const readReplaySetting = (nodeEnv: string, enabled: string) => {
    const result = Bun.spawnSync({
      cmd: [process.execPath, '-e', 'import {telemetryConfig} from "./src/telemetryConfig.ts"; console.log(telemetryConfig.sentryReplay)'],
      cwd: resolve(import.meta.dir, '../..'),
      env: {...process.env, NODE_ENV: nodeEnv, SENTRY_REPLAY_ENABLED: enabled},
      stdout: 'pipe', stderr: 'pipe',
    });
    expect(result.exitCode).toBe(0);
    return result.stdout.toString().trim();
  };
  expect(readReplaySetting('production', '')).toBe('false');
  expect(readReplaySetting('development', 'true')).toBe('false');
  expect(readReplaySetting('production', 'true')).toBe('true');
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
