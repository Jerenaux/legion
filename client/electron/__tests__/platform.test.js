const {getPlatformAuth, showGamepadTextInput, getControllerType, shutdownPlatform} = require("../platform");

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

test("falls back to a direct session outside store launchers", async () => {
  await expect(getPlatformAuth({}, () => { throw new Error("Steam is not running"); })).resolves.toBeNull();
});

test("uses Steam's native gamepad keyboard and controller type when available", async () => {
  const show = jest.fn(async () => "Legionary");
  const controller = {getType: () => "SteamDeckController"};
  await getPlatformAuth({}, () => ({init: () => ({
    auth: {getAuthTicketForWebApi: async () => ({cancel: jest.fn(), getBytes: () => Buffer.from("ticket")})},
    utils: {showGamepadTextInput: show},
    input: {init: jest.fn(), shutdown: jest.fn(), getControllers: () => [controller]},
  })}));

  await expect(showGamepadTextInput({description: "Name", maxCharacters: 12, existingText: "A"}))
    .resolves.toBe("Legionary");
  expect(show).toHaveBeenCalledWith(0, 0, "Name", 12, "A");
  expect(getControllerType()).toBe("SteamDeckController");
});
