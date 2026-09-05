import { describe, expect, test } from "bun:test";

import {
  canonicalUID,
  identityKey,
  validateDirectDevice,
  validateItchKey,
  validateSteamTicket,
} from "../platformIdentity";
import { starterCharacterId } from "../playerProvisioning";

describe("platform identity", () => {
  test("builds stable safe identity keys and Firebase UIDs", () => {
    expect(identityKey("steam", "76561198000000000")).toBe("steam:76561198000000000");
    expect(canonicalUID("steam:76561198000000000")).toMatch(/^player_[a-f0-9]{32}$/);
    expect(canonicalUID("steam:76561198000000000")).toBe(canonicalUID("steam:76561198000000000"));
  });

  test("validates a Steam Web API ticket server-side", async () => {
    const fetcher = async (url: string) => {
      expect(url).toContain("ticket=deadbeef");
      expect(url).toContain("identity=legion");
      return new Response(JSON.stringify({ response: { params: { result: "OK", steamid: "7656" } } }), { status: 200 });
    };
    await expect(
      validateSteamTicket(
        "deadbeef",
        {
          appId: "123",
          apiKey: "secret",
          identity: "legion",
        },
        fetcher,
      ),
    ).resolves.toBe("7656");
  });

  test("rejects an invalid Steam response", async () => {
    const fetcher = async () =>
      new Response(JSON.stringify({ response: { params: { result: "Invalid" } } }), { status: 200 });
    await expect(validateSteamTicket("bad", { appId: "1", apiKey: "k", identity: "legion" }, fetcher)).rejects.toThrow(
      "Steam ticket rejected",
    );
  });

  test("validates an Itch session key", async () => {
    const fetcher = async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe("itch-key");
      return new Response(JSON.stringify({ user: { id: 42 } }), { status: 200 });
    };
    await expect(validateItchKey("itch-key", fetcher)).resolves.toBe("42");
  });

  test("accepts only bounded direct device identifiers", () => {
    expect(validateDirectDevice("9db50a39-843a-4cc0-92b2-e688195d64ec")).toBe("9db50a39-843a-4cc0-92b2-e688195d64ec");
    expect(() => validateDirectDevice("short")).toThrow("Invalid device identifier");
  });

  test("uses deterministic starter character ids for idempotent provisioning", () => {
    expect(starterCharacterId("player_abc", 0)).toBe("player_abc-starter-0");
    expect(starterCharacterId("player_abc", 2)).toBe("player_abc-starter-2");
  });
});
