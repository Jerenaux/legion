export type TokenVerifier = (token: string) => Promise<{ uid?: string }>;

export class AuthenticationError extends Error {
  name = 'AuthenticationError';
}

export const isDevelopmentEnvironment = (nodeEnv: string | undefined): boolean =>
  nodeEnv === "development" || nodeEnv === "docker";

export function extractBearerToken(authorization: string | undefined): string {
  const match = authorization?.match(/^Bearer\s+(.+)$/);
  if (!match?.[1]) throw new AuthenticationError("Bearer token required");
  return match[1];
}

export async function verifyUID(
  authorization: string | undefined,
  verifyToken: TokenVerifier,
): Promise<string> {
  const token = extractBearerToken(authorization);
  try {
    const decoded = await verifyToken(token);
    if (!decoded.uid) throw new Error("Verified token has no uid");
    return decoded.uid;
  } catch (error) {
    // Do not hide verifier outages, service-account errors, or unexpected failures.
    const rejectionCodes = ['auth/argument-error', 'auth/invalid-id-token', 'auth/id-token-expired',
      'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'];
    if (error && typeof error === 'object' && 'code' in error && rejectionCodes.includes(String(error.code))) {
      throw new AuthenticationError('Invalid or expired bearer token');
    }
    throw error;
  }
}

export function hasValidAPIKey(
  supplied: string | string[] | undefined,
  expected: string | undefined,
  isDevelopment: boolean,
): boolean {
  if (isDevelopment) return true;
  return typeof supplied === "string" && !!expected && supplied === expected;
}
