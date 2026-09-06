export interface AuthenticatedSocketData {
  handshake: {auth?: {token?: unknown}};
  firebaseToken?: string;
  uid?: string;
}

export async function authenticateSocket(
  socket: AuthenticatedSocketData,
  verifyToken: (token: string) => Promise<{uid?: string}>,
): Promise<void> {
  const token = socket.handshake?.auth?.token;
  if (typeof token !== "string" || !token) throw new Error("Missing authentication token");
  const identity = await verifyToken(token);
  if (!identity.uid) throw new Error("Invalid authenticated user");
  socket.firebaseToken = token;
  socket.uid = identity.uid;
}
