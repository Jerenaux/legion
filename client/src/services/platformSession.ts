export type PlatformCredential = {
  provider: "steam" | "itch" | "direct";
  credential: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type PlatformAPI = {getPlatformAuth?: () => Promise<PlatformCredential | null>};
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
  if (native) return native;
  return {provider: "direct", credential: getOrCreateDeviceId(storage, randomUUID)};
}

export async function exchangePlatformCredential(
  apiBaseUrl: string,
  credential: PlatformCredential,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const response = await fetcher(`${apiBaseUrl}/createPlatformSession`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(credential),
  });
  if (!response.ok) throw new Error("Platform authentication failed");
  const session = await response.json() as {customToken?: string};
  if (!session.customToken) throw new Error("Platform session returned no token");
  return session.customToken;
}
