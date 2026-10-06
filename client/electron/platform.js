const STEAM_WEB_API_IDENTITY = "legion";
let activeTicket;
let activeSteamClient;
let pendingAuth;
let giftReader;

function getSteamGiftToken(steamworksRoot) {
  if (!activeSteamClient) return null;
  giftReader ||= require('./steam-launch').createSteamGiftReader(steamworksRoot);
  return giftReader();
}

function getSteamClient(env, loadSteamworks) {
  if (env.ITCHIO_API_KEY || env.USE_DIRECT_AUTH === "true") return null;
  const appId = Number(env.SteamAppId || env.STEAM_APP_ID);
  if (!Number.isSafeInteger(appId) || appId <= 0 || appId > 0xffffffff) return null;
  if (!activeSteamClient) activeSteamClient = loadSteamworks().init(appId);
  return activeSteamClient;
}

function getPlatformLanguage(env = process.env, loadSteamworks = () => require("steamworks.js")) {
  try {
    const language = getSteamClient(env, loadSteamworks)?.apps?.currentGameLanguage();
    return typeof language === "string" && /^[a-z-]{1,64}$/.test(language) ? language : null;
  } catch { return null; }
}

async function getPlatformAuth(env = process.env, loadSteamworks = () => require("steamworks.js")) {
  if (env.ITCHIO_API_KEY) return {provider: "itch", credential: env.ITCHIO_API_KEY};
  try {
    const client = getSteamClient(env, loadSteamworks);
    if (!client) return null;
    // Startup only reads the language. Concurrent renderer requests share one ticket request.
    if (pendingAuth) return await pendingAuth;
    const request = (async () => {
      const ticket = await client.auth.getAuthTicketForWebApi(
        env.STEAM_WEB_API_IDENTITY || STEAM_WEB_API_IDENTITY,
      );
      if (client !== activeSteamClient) { ticket.cancel(); return null; }
      activeTicket?.cancel();
      activeTicket = ticket;
      return {provider: "steam", credential: ticket.getBytes().toString("hex")};
    })();
    pendingAuth = request;
    try { return await request; }
    finally { if (pendingAuth === request) pendingAuth = undefined; }
  } catch (_error) {
    // An installed Steam build must not silently claim a gift on a device account
    // when Steam is temporarily unavailable. Let the connection screen retry.
    throw new Error('Steam authentication is unavailable. Please restart Steam and retry.');
  }
}

async function showGamepadTextInput(options = {}) {
  if (!activeSteamClient?.utils?.showGamepadTextInput) return null;
  const description = typeof options.description === "string" ? options.description.slice(0, 128) : "Enter text";
  const maxCharacters = Number.isInteger(options.maxCharacters) ? Math.min(4096, Math.max(1, options.maxCharacters)) : 256;
  const existingText = typeof options.existingText === "string" ? options.existingText.slice(0, maxCharacters) : "";
  return activeSteamClient.utils.showGamepadTextInput(
    options.password ? 1 : 0,
    options.multiline ? 1 : 0,
    description,
    maxCharacters,
    existingText,
  );
}

function getControllerType() {
  try {
    activeSteamClient?.input?.init?.();
    return activeSteamClient?.input?.getControllers?.()[0]?.getType?.() || null;
  } catch {
    return null;
  }
}

function shutdownPlatform() {
  activeTicket?.cancel();
  activeTicket = undefined;
  pendingAuth = undefined;
  activeSteamClient?.input?.shutdown?.();
  activeSteamClient = undefined;
  giftReader = undefined;
}

module.exports = {getPlatformLanguage, getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform, getSteamGiftToken};
