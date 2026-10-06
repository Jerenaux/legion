import { test, expect } from 'bun:test';
import {createRefreshingSocketAuth, retrySocketAuthentication, shouldAbandonGame, socketReconnectOptions} from "../socketPolicy";

test("keeps retrying transient realtime disconnects", () => {
  expect(socketReconnectOptions.reconnection).toBe(true);
  expect(socketReconnectOptions.reconnectionAttempts).toBe(Infinity);
  expect(shouldAbandonGame("transport close")).toBe(false);
  expect(shouldAbandonGame("ping timeout")).toBe(false);
  expect(shouldAbandonGame("io server disconnect")).toBe(true);
});

test("gets fresh authentication for every socket connection attempt", async () => {
  let tokenNumber = 0;
  const auth = createRefreshingSocketAuth(async () => `token-${++tokenNumber}`, {gameId: "game-1"});
  const authenticate = () => new Promise<Record<string, unknown>>(resolve => auth(resolve));

  await expect(authenticate()).resolves.toEqual({gameId: "game-1", storeBuild: false, token: "token-1"});
  await expect(authenticate()).resolves.toEqual({gameId: "game-1", storeBuild: false, token: "token-2"});
});


test("failed token refresh keeps the build classification and clears the token", async () => {
  const auth = createRefreshingSocketAuth(async () => {throw new Error("offline");}, {storeBuild: true});
  const result = await new Promise<Record<string, unknown>>(resolve => auth(resolve));
  expect(result).toEqual({token: "", storeBuild: false});
});

test('forces one token refresh on authentication rejection, never on transport errors', async () => {
  let refreshes = 0, connects = 0;
  const socket = {connect: () => {connects++;}};
  const getToken = async (force?: boolean) => {expect(force).toBe(true); refreshes++; return 'new';};
  expect(retrySocketAuthentication(socket, new Error('offline'), getToken)).toBe(false);
  expect(retrySocketAuthentication(socket, new Error('Authentication failed'), getToken)).toBe(true);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(refreshes).toBe(1); expect(connects).toBe(1);
  expect(retrySocketAuthentication(socket, new Error('Authentication failed'), getToken)).toBe(false);
});
