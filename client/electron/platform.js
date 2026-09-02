const STEAM_APP_ID = 3729580;
const STEAM_WEB_API_IDENTITY = "legion";
let activeTicket;
let activeSteamClient;

async function getPlatformAuth(env = process.env, loadSteamworks = () => require("steamworks.js")) {
  if (env.ITCHIO_API_KEY) return {provider: "itch", credential: env.ITCHIO_API_KEY};
  if (env.USE_DIRECT_AUTH === "true") return null;

  try {
    const steamworks = loadSteamworks();
    const client = steamworks.init(Number(env.STEAM_APP_ID) || STEAM_APP_ID);
    activeSteamClient = client;
    activeTicket?.cancel();
    activeTicket = await client.auth.getAuthTicketForWebApi(
      env.STEAM_WEB_API_IDENTITY || STEAM_WEB_API_IDENTITY,
    );
    return {provider: "steam", credential: activeTicket.getBytes().toString("hex")};
  } catch (error) {
    if (env.NODE_ENV === "development") console.info("Steam is unavailable; using a direct session.");
    return null;
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
  activeSteamClient?.input?.shutdown?.();
  activeSteamClient = undefined;
}

module.exports = {getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform, STEAM_APP_ID};
