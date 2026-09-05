import { expect, test } from "bun:test";
import { authenticateSocket } from "@legion/shared/socketAuth";

test("authenticates a socket before handlers are registered", async () => {
  const socket: any = { handshake: { auth: { token: "valid" } } };
  await authenticateSocket(socket, async (token) => ({ uid: token === "valid" ? "player-1" : "" }));
  expect(socket.firebaseToken).toBe("valid");
  expect(socket.uid).toBe("player-1");
});

test("rejects missing and invalid socket identities", async () => {
  await expect(authenticateSocket({ handshake: { auth: {} } }, async () => ({ uid: "unused" }))).rejects.toThrow(
    "Missing authentication token",
  );
  await expect(
    authenticateSocket({ handshake: { auth: { token: "bad" } } }, async () => ({ uid: "" })),
  ).rejects.toThrow("Invalid authenticated user");
});
