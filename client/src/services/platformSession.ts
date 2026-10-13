export type PlatformCredential = {
  provider: "steam" | "itch" | "direct";
  credential: string;
};

export type SessionFailure = 'steam' | 'itch' | 'network' | 'service' | 'unknown';
export type PlatformAuthResult = PlatformCredential | {error: 'steam'} | null;

export class SessionError extends Error {
  constructor(public readonly reason: SessionFailure, message: string) {
    super(message);
  }
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type PlatformAPI = {getPlatformAuth?: () => Promise<PlatformAuthResult>};
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const DEVICE_ID_KEY = "legion.deviceId";

export function getOrCreateDeviceId(storage: StorageLike, randomUUID: () => string): string {
  const existing = storage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = randomUUID();
  storage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function getPlatformCredential(
  platformAPI: PlatformAPI | null,
  storage: StorageLike,
  randomUUID: () => string,
): Promise<PlatformCredential> {
  const native = await platformAPI?.getPlatformAuth?.();
  if (native) {
    if ('error' in native) throw new SessionError(native.error, 'Steam authentication unavailable');
    return native;
  }
  return {provider: "direct", credential: getOrCreateDeviceId(storage, randomUUID)};
}

export async function exchangePlatformCredential(
  apiBaseUrl: string,
  credential: PlatformCredential,
  fetcher: Fetcher = fetch,
  signal?: AbortSignal,
): Promise<string> {
  // Provisioning is idempotent: retrying the same credential cannot create a second player.
  for (let attempt = 0; attempt < 3; attempt++) {
    signal?.throwIfAborted();
    const attemptSignal = AbortSignal.any([
      AbortSignal.timeout(8000), ...(signal ? [signal] : []),
    ]);
    try {
      const response = await fetcher(`${apiBaseUrl}/createPlatformSession`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(credential),
        signal: attemptSignal,
      });
      if (!response.ok) {
        const reason = [401, 403].includes(response.status) && credential.provider !== 'direct'
          ? credential.provider : 'service';
        const error = new SessionError(reason, `Platform authentication failed (HTTP ${response.status})`);
        if (![408, 429].includes(response.status) && response.status < 500) throw error;
        // Drain the error response before retrying so the connection can be reused.
        await response.text();
        if (attempt === 2) throw error;
      } else {
        const session = await response.json() as {customToken?: string};
        if (!session.customToken) throw new SessionError("service", "Platform session returned no token");
        return session.customToken;
      }
    } catch (error) {
      signal?.throwIfAborted();
      // Fetch rejects with TypeError on network failures; response/validation errors are terminal.
      const networkFailure = attemptSignal.aborted || error instanceof TypeError;
      if (attempt === 2 || !networkFailure) {
        if (networkFailure) throw new SessionError('network', 'Platform exchange could not complete');
        throw error;
      }
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => { clearTimeout(timer); reject(signal?.reason); };
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, 250 * (attempt + 1));
      signal?.addEventListener("abort", onAbort, {once: true});
      if (signal?.aborted) onAbort();
    });
  }
  throw new Error("Platform authentication unavailable");
}
