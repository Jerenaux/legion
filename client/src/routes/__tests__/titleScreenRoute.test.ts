import {expect, test} from "bun:test";
import {titlePlayRoute} from "../titleScreenRoute";

test("starts newcomers in the tutorial after Play", () => {
  expect(titlePlayRoute(0)).toBe("/game/0");
  expect(titlePlayRoute(1)).toBe("/play");
});
