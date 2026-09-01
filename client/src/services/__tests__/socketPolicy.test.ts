import {shouldAbandonGame, socketReconnectOptions} from "../socketPolicy";

test("keeps retrying transient realtime disconnects", () => {
  expect(socketReconnectOptions.reconnection).toBe(true);
  expect(socketReconnectOptions.reconnectionAttempts).toBe(Infinity);
  expect(shouldAbandonGame("transport close")).toBe(false);
  expect(shouldAbandonGame("ping timeout")).toBe(false);
  expect(shouldAbandonGame("io server disconnect")).toBe(true);
});
