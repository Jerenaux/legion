const {getPlatformLanguage, getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform} = require("../platform");

afterEach(shutdownPlatform);

test("uses an Itch app key when launched by the Itch app", async () => {
  await expect(getPlatformAuth({ITCHIO_API_KEY: "itch-key"}, () => { throw new Error("unused"); }))
    .resolves.toEqual({provider: "itch", credential: "itch-key"});
});

test("creates a Steam Web API ticket", async () => {
  const cancel = jest.fn();
  const getAuthTicketForWebApi = jest.fn(async () => ({cancel, getBytes: () => Buffer.from("ticket")}));
  const init = jest.fn(() => ({auth: {getAuthTicketForWebApi}}));
  await expect(getPlatformAuth({STEAM_APP_ID: "42"}, () => ({init}))).resolves.toEqual({
    provider: "steam",
    credential: Buffer.from("ticket").toString("hex"),
  });
  expect(init).toHaveBeenCalledWith(42);
  expect(getAuthTicketForWebApi).toHaveBeenCalledWith("legion");
});

test("uses the Demo App ID supplied by Steam instead of a full-game override", async () => {
  const init = jest.fn(() => ({auth: {
    getAuthTicketForWebApi: async () => ({cancel: jest.fn(), getBytes: () => Buffer.from("demo-ticket")}),
  }}));
  await expect(getPlatformAuth({SteamAppId: "3996730", STEAM_APP_ID: "3729580"}, () => ({init})))
    .resolves.toEqual({provider: "steam", credential: Buffer.from("demo-ticket").toString("hex")});
  expect(init).toHaveBeenCalledWith(3996730);
});

test("direct downloads do not initialize Steam just because it is installed", async () => {
  const loadSteamworks = jest.fn();
  await expect(getPlatformAuth({}, loadSteamworks)).resolves.toBeNull();
  expect(loadSteamworks).not.toHaveBeenCalled();
});

test.each(["", "invalid", "-1", "1.5", "4294967296"])("ignores invalid Steam App ID %s", async (SteamAppId) => {
  const loadSteamworks = jest.fn();
  await expect(getPlatformAuth({SteamAppId}, loadSteamworks)).resolves.toBeNull();
  expect(loadSteamworks).not.toHaveBeenCalled();
});

test("falls back to a direct session when Steam initialization fails", async () => {
  await expect(getPlatformAuth({SteamAppId: "3996730"}, () => { throw new Error("Steam is not running"); })).resolves.toBeNull();
});

test("can force a direct session for local development", async () => {
  await expect(getPlatformAuth({USE_DIRECT_AUTH: "true"}, () => { throw new Error("unused"); }))
    .resolves.toBeNull();
});

test("uses Steam's native gamepad keyboard and controller type when available", async () => {
  const show = jest.fn(async () => "Legionary");
  const controller = {getType: () => "SteamDeckController"};
  await getPlatformAuth({SteamAppId: "3996730"}, () => ({init: () => ({
    auth: {getAuthTicketForWebApi: async () => ({cancel: jest.fn(), getBytes: () => Buffer.from("ticket")})},
    utils: {showGamepadTextInput: show},
    input: {init: jest.fn(), shutdown: jest.fn(), getControllers: () => [controller]},
  })}));

  await expect(showGamepadTextInput({description: "Name", maxCharacters: 12, existingText: "A"}))
    .resolves.toBe("Legionary");
  expect(show).toHaveBeenCalledWith(0, 0, "Name", 12, "A");
  expect(getControllerType()).toBe("SteamDeckController");
});


test("reads Steam's game language before authentication and initializes the SDK only once", async () => {
  const getAuthTicketForWebApi = jest.fn(async () => ({cancel: jest.fn(), getBytes: () => Buffer.from("ticket")}));
  const init = jest.fn(() => ({apps: {currentGameLanguage: () => "portuguese"}, auth: {getAuthTicketForWebApi}}));
  const env = {SteamAppId: "3996730"};
  expect(getPlatformLanguage(env, () => ({init}))).toBe("portuguese");
  expect(getAuthTicketForWebApi).not.toHaveBeenCalled();
  const credentials = await Promise.all([getPlatformAuth(env, () => ({init})), getPlatformAuth(env, () => ({init}))]);
  expect(credentials[0]).toEqual({provider: "steam", credential: Buffer.from("ticket").toString("hex")});
  expect(credentials[1]).toEqual(credentials[0]);
  expect(getPlatformLanguage(env, () => ({init}))).toBe("portuguese");
  expect(init).toHaveBeenCalledTimes(1);
  expect(getAuthTicketForWebApi).toHaveBeenCalledTimes(1);
});

test.each([{}, {ITCHIO_API_KEY: "itch-key", SteamAppId: "3996730"}, {USE_DIRECT_AUTH: "true", SteamAppId: "3996730"}])(
  "non-Steam sessions do not load Steam for language detection", env => {
    const loadSteamworks = jest.fn();
    expect(getPlatformLanguage(env, loadSteamworks)).toBeNull();
    expect(loadSteamworks).not.toHaveBeenCalled();
  },
);

test("Steam language failures fall back without preventing later authentication", async () => {
  expect(getPlatformLanguage({SteamAppId: "3996730"}, () => { throw new Error("Steam unavailable"); })).toBeNull();
  const init = jest.fn(() => ({apps: {currentGameLanguage: () => { throw new Error("Language unavailable"); }}, auth: {
    getAuthTicketForWebApi: async () => ({cancel: jest.fn(), getBytes: () => Buffer.from("ticket")}),
  }}));
  expect(getPlatformLanguage({SteamAppId: "3996730"}, () => ({init}))).toBeNull();
  expect(await getPlatformAuth({SteamAppId: "3996730"}, () => ({init}))).toEqual({provider: "steam", credential: Buffer.from("ticket").toString("hex")});
  expect(init).toHaveBeenCalledTimes(1);
});

test("a ticket completed after shutdown is cancelled", async () => {
  let complete;
  const ticket = {cancel: jest.fn(), getBytes: () => Buffer.from("ticket")};
  const request = getPlatformAuth({SteamAppId: "3996730"}, () => ({init: () => ({auth: {
    getAuthTicketForWebApi: () => new Promise(resolve => { complete = resolve; }),
  }})}));
  shutdownPlatform();
  complete(ticket);
  await expect(request).resolves.toBeNull();
  expect(ticket.cancel).toHaveBeenCalledTimes(1);
});


test("preload exposes Steam language synchronously without requesting authentication", () => {
  const {runInNewContext} = require("node:vm");
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../../preload.js"), "utf8");
  for (const [args, expected] of [[[], null], [["--legion-steam-language=tchinese"], "tchinese"]]) {
    let api;
    const invoke = jest.fn();
    runInNewContext(source, {
      process: {argv: args},
      require: () => ({contextBridge: {exposeInMainWorld: (_name, value) => { api = value; }}, ipcRenderer: {invoke}}),
    });
    expect(api.steamLanguage).toBe(expected);
    expect(Object.isFrozen(api)).toBe(true);
    expect(invoke).not.toHaveBeenCalled();
  }
});
