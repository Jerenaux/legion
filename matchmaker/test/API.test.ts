import { expect, test } from "bun:test";

import { createApiHeaders } from "../src/API";

test("uses the service key for internal calls without a player token", () => {
    const headers = createApiHeaders({}, "", "service-secret");
    expect(headers.get("x-api-key")).toBe("service-secret");
    expect(headers.has("Authorization")).toBe(false);
});

test("uses the player token when one is supplied", () => {
    const headers = createApiHeaders({}, "player-token", "service-secret");
    expect(headers.get("Authorization")).toBe("Bearer player-token");
    expect(headers.has("x-api-key")).toBe(false);
});
