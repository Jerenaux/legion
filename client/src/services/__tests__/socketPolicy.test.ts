import { test, expect } from "bun:test";
import { createRefreshingSocketAuth, shouldAbandonGame, socketReconnectOptions } from "../socketPolicy";

test("keeps retrying transient realtime disconnects", () => {
  expect(socketReconnectOptions.reconnection).toBe(true);
  expect(socketReconnectOptions.reconnectionAttempts).toBe(Infinity);
  expect(shouldAbandonGame("transport close")).toBe(false);
  expect(shouldAbandonGame("ping timeout")).toBe(false);
  expect(shouldAbandonGame("io server disconnect")).toBe(true);
});

test("gets fresh authentication for every socket connection attempt", async () => {
  let tokenNumber = 0;
  const auth = createRefreshingSocketAuth(async () => `token-${++tokenNumber}`, { gameId: "game-1" });
  const authenticate = () => new Promise<Record<string, unknown>>((resolve) => auth(resolve));

  await expect(authenticate()).resolves.toEqual({ gameId: "game-1", token: "token-1" });
  await expect(authenticate()).resolves.toEqual({ gameId: "game-1", token: "token-2" });
});
