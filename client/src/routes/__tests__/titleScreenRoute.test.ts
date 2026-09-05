import {expect, test} from "bun:test";
import {STEAM_STORE_URL, titlePlayRoute} from "../titleScreenRoute";

test("starts newcomers in the tutorial after Play", () => {
  expect(titlePlayRoute(0)).toBe("/game/0");
  expect(titlePlayRoute(1)).toBe("/play");
});

test("links to Legion's Steam store page", () => {
  expect(STEAM_STORE_URL).toBe("https://store.steampowered.com/app/3729580/Legion/?utm_source=itch");
});
