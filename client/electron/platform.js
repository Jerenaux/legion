const STEAM_WEB_API_IDENTITY = "legion";
let activeTicket;
let activeSteamClient;
let pendingAuth;
let launchReader;
const lastAuthReports = new Map();
// Only recognize fixed SDK messages/codes; never send native messages, stacks or ticket bytes.
const authReasons = new Map([
  ["Steam didn't validated the ticket in time.", 'ticket_timeout'],
  ["there isn't a network connection to steam or it failed to connect", 'no_connection'],
  ['user not logged on', 'not_logged_on'],
  ['connect failed', 'connect_failed'],
  ['requested service is unavailable', 'service_unavailable'],
  ['operation timed out', 'timeout'],
  ['password or ticket is invalid', 'invalid_ticket'],
  ['failed to init the steamworks API', 'initialization_failed'],
]);

function reportAuthFailure(error, stage, startedAt) {
  try {
    const code = ['GenericFailure', 'InvalidArg', 'ERR_DLOPEN_FAILED', 'MODULE_NOT_FOUND'].includes(error?.code)
      ? error.code : 'unknown';
    const reason = authReasons.get(error?.message) || 'unknown';
    const key = `${stage}:${code}:${reason}`;
    const now = Date.now();
    if (now - (lastAuthReports.get(key) ?? -Infinity) < 60000) return;
    lastAuthReports.set(key, now);
    require('@sentry/electron/main').captureException(new Error(`Steam authentication failed during ${stage}`), {
      tags: {'steam.auth_stage': stage, 'steam.auth_reason': reason},
      contexts: {steam_auth: {stage, reason, code, elapsed_ms: now - startedAt,
        client_initialized: Boolean(activeSteamClient), architecture: process.arch}},
    });
  } catch { /* Diagnostics must never change the sign-in result. */ }
}

/** Reads a `steam://run/<app>/?key=value` launch parameter ("gift", "community"). */
function getSteamLaunchParam(steamworksRoot, key) {
  if (!activeSteamClient) return null;
  launchReader ||= require('./steam-launch').createSteamLaunchReader(steamworksRoot);
  return launchReader(key);
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
  // Share the result, including failure reporting, across concurrent native IPC requests.
  if (pendingAuth) return pendingAuth;
  const request = (async () => {
    const startedAt = Date.now();
    let stage = 'sdk_initialization';
    try {
      const client = getSteamClient(env, loadSteamworks);
      if (!client) return null;
      stage = 'ticket_request';
      const ticket = await client.auth.getAuthTicketForWebApi(
        env.STEAM_WEB_API_IDENTITY || STEAM_WEB_API_IDENTITY,
      );
      stage = 'ticket_preparation';
      if (client !== activeSteamClient) { ticket.cancel(); return null; }
      activeTicket?.cancel();
      activeTicket = ticket;
      return {provider: "steam", credential: ticket.getBytes().toString("hex")};
    } catch (error) {
      reportAuthFailure(error, stage, startedAt);
      // Preserve the Steam account: never fall back to a device account on native failure.
      // Electron IPC drops custom Error properties; return a safe, structured reason.
      return {error: 'steam'};
    }
  })();
  pendingAuth = request;
  try { return await request; }
  finally { if (pendingAuth === request) pendingAuth = undefined; }
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
  launchReader = undefined;
}

module.exports = {getPlatformLanguage, getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform, getSteamLaunchParam};
