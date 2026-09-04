import { test, expect } from 'bun:test';
import {defaultGameSettings, parseGameSettings} from "../../settings";

test("falls back safely when desktop settings are corrupt", () => {
  expect(parseGameSettings("not-json")).toEqual(defaultGameSettings);
  expect(parseGameSettings('{"musicVolume":999,"sfxVolume":-2,"keyboardLayout":0,"isFullscreen":true}'))
    .toEqual({musicVolume: 100, sfxVolume: 0, keyboardLayout: 0, isFullscreen: true});
});
