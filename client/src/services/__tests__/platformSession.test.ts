import { describe, test, expect } from 'bun:test';
import {
  exchangePlatformCredential,
  getOrCreateDeviceId,
  getPlatformCredential,
} from "../platformSession";

describe("desktop platform sessions", () => {
  test("prefers a native Steam or Itch credential", async () => {
    const native = {provider: "steam" as const, credential: "deadbeef"};
    const storage = {getItem: () => null, setItem: () => undefined};
    await expect(getPlatformCredential({getPlatformAuth: async () => native}, storage, () => "unused"))
      .resolves.toEqual(native);
  });

  test("persists one direct-download device identity", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) || null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };
    expect(getOrCreateDeviceId(adapter, () => "12345678-1234-4123-8123-123456789abc"))
      .toBe("12345678-1234-4123-8123-123456789abc");
    expect(getOrCreateDeviceId(adapter, () => "different-device-id-123456789"))
      .toBe("12345678-1234-4123-8123-123456789abc");
  });

  test("exchanges the credential for a Firebase custom token", async () => {
    const fetcher = async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(init?.body as string)).toEqual({provider: "itch", credential: "key"});
      return new Response(JSON.stringify({customToken: "firebase-token"}), {status: 200});
    };
    await expect(exchangePlatformCredential("https://api", {provider: "itch", credential: "key"}, fetcher))
      .resolves.toBe("firebase-token");
  });
});
