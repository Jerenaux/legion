import { test, expect } from 'bun:test';
import { telemetryConfig } from "../telemetryConfig";

test("keeps LogRocket while disabling browser session capture", () => {
  expect(telemetryConfig.logRocket).toBe(true);
  expect(telemetryConfig.hotjar).toBe(false);
  expect(telemetryConfig.sentryReplay).toBe(false);
});
