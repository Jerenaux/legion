import { describe, expect, test } from "bun:test";

import { extractBearerToken, hasValidAPIKey, verifyUID } from "../authPolicy";

describe("API authentication policy", () => {
  test("rejects a missing or malformed bearer token", () => {
    expect(() => extractBearerToken(undefined)).toThrow("Bearer token required");
    expect(() => extractBearerToken("Basic abc")).toThrow("Bearer token required");
    expect(() => extractBearerToken("Bearer ")).toThrow("Bearer token required");
  });

  test("rejects an invalid token instead of returning an empty uid", async () => {
    await expect(verifyUID("Bearer bad", async () => {
      throw new Error("invalid token");
    })).rejects.toThrow("invalid token");
  });

  test("returns only a verified non-empty uid", async () => {
    await expect(verifyUID("Bearer good", async (token) => ({ uid: token }))).resolves.toBe("good");
    await expect(verifyUID("Bearer bad", async () => ({ uid: "" }))).rejects.toThrow("Verified token has no uid");
  });

  test("requires an exact service key in production", () => {
    expect(hasValidAPIKey("secret", "secret", false)).toBe(true);
    expect(hasValidAPIKey("wrong", "secret", false)).toBe(false);
    expect(hasValidAPIKey(undefined, "secret", false)).toBe(false);
    expect(hasValidAPIKey("secret", undefined, false)).toBe(false);
    expect(hasValidAPIKey(undefined, undefined, true)).toBe(true);
  });
});
