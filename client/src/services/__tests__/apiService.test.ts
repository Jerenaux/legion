import { test, expect } from 'bun:test';
import { getTokenWithRetry } from "../firebaseToken";

test("uses Firebase's cached token unless a refresh is requested", async () => {
  const calls: boolean[] = [];
  const user = {
    getIdToken: async (forceRefresh = false) => {
      calls.push(forceRefresh);
      return "token";
    },
  };

  await expect(getTokenWithRetry(user, false, 1, 0)).resolves.toBe("token");
  await expect(getTokenWithRetry(user, true, 1, 0)).resolves.toBe("token");
  expect(calls).toEqual([false, true]);
});
