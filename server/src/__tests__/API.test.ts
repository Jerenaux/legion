import { createApiHeaders } from "../API";

describe("internal API headers", () => {
  test("uses the service key when no player token is supplied", () => {
    const headers = createApiHeaders({}, "", "service-secret");
    expect(headers.get("x-api-key")).toBe("service-secret");
    expect(headers.has("Authorization")).toBe(false);
  });

  test("uses a bearer token for player-scoped calls", () => {
    const headers = createApiHeaders({}, "player-token", "service-secret");
    expect(headers.get("Authorization")).toBe("Bearer player-token");
    expect(headers.has("x-api-key")).toBe(false);
  });
});
