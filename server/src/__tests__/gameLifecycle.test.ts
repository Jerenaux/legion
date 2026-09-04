import { test, expect } from 'bun:test';
import {shouldRetireGame} from "../gameLifecycle";

test("retires completed games only after the reconnect window", () => {
  expect(shouldRetireGame({gameOver: false, endedAt: 1}, 1_000_000)).toBe(false);
  expect(shouldRetireGame({gameOver: true, endedAt: 900_000}, 1_000_000)).toBe(false);
  expect(shouldRetireGame({gameOver: true, endedAt: 1}, 1_000_000)).toBe(true);
});
