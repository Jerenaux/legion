import { createHash } from "node:crypto";

export type PlatformProvider = "steam" | "itch" | "direct";
type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export function identityKey(provider: PlatformProvider, externalId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(externalId)) throw new Error("Invalid external identity");
  return `${provider}:${externalId}`;
}

export function canonicalUID(key: string): string {
  return `player_${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
}

export function validateDirectDevice(deviceId: string): string {
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(deviceId)) throw new Error("Invalid device identifier");
  return deviceId;
}

export async function validateSteamTicket(
  ticket: string,
  config: { appId: string; apiKey: string; identity: string },
  fetcher: Fetcher = fetch,
): Promise<string> {
  if (!/^[0-9a-f]+$/i.test(ticket)) throw new Error("Invalid Steam ticket");
  if (!config.appId || !config.apiKey || !config.identity) throw new Error("Steam authentication is not configured");
  const params = new URLSearchParams({
    key: config.apiKey,
    appid: config.appId,
    ticket,
    identity: config.identity,
  });
  const response = await fetcher(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/?${params}`);
  if (!response.ok) throw new Error("Steam authentication unavailable");
  const body = (await response.json()) as any;
  const result = body?.response?.params;
  if (result?.result !== "OK" || !result?.steamid) throw new Error("Steam ticket rejected");
  return String(result.steamid);
}

export async function validateItchKey(apiKey: string, fetcher: Fetcher = fetch): Promise<string> {
  if (!apiKey || apiKey.length > 512) throw new Error("Invalid Itch key");
  const response = await fetcher("https://api.itch.io/profile", {
    headers: { Authorization: apiKey },
  });
  if (!response.ok) throw new Error("Itch key rejected");
  const body = (await response.json()) as any;
  if (!body?.user?.id) throw new Error("Itch profile missing user id");
  return String(body.user.id);
}
