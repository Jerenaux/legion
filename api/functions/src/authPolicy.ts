export type TokenVerifier = (token: string) => Promise<{ uid?: string }>;

export const isDevelopmentEnvironment = (nodeEnv: string | undefined): boolean =>
  nodeEnv === "development" || nodeEnv === "docker";

export function extractBearerToken(authorization: string | undefined): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/);
  if (!match?.[1]) throw new Error("Bearer token required");
  return match[1];
}

export async function verifyUID(
  authorization: string | undefined,
  verifyToken: TokenVerifier,
): Promise<string> {
  const token = extractBearerToken(authorization);
  const decoded = await verifyToken(token);
  if (!decoded.uid) throw new Error("Verified token has no uid");
  return decoded.uid;
}

export function hasValidAPIKey(
  supplied: string | string[] | undefined,
  expected: string | undefined,
  isDevelopment: boolean,
): boolean {
  if (isDevelopment) return true;
  return typeof supplied === "string" && !!expected && supplied === expected;
}
