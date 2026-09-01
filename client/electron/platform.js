const STEAM_APP_ID = 3729580;
const STEAM_WEB_API_IDENTITY = "legion";
let activeTicket;

async function getPlatformAuth(env = process.env, loadSteamworks = () => require("steamworks.js")) {
  if (env.ITCHIO_API_KEY) return {provider: "itch", credential: env.ITCHIO_API_KEY};

  try {
    const steamworks = loadSteamworks();
    const client = steamworks.init(Number(env.STEAM_APP_ID) || STEAM_APP_ID);
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

function shutdownPlatform() {
  activeTicket?.cancel();
  activeTicket = undefined;
}

module.exports = {getPlatformAuth, shutdownPlatform, STEAM_APP_ID};
