const {getPlatformAuth} = require("../platform");

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
