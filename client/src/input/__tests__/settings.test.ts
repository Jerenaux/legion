import { test, expect } from 'bun:test';
import {defaultGameSettings, parseGameSettings} from "../../settings";

test("falls back safely when desktop settings are corrupt", () => {
  expect(parseGameSettings("not-json")).toEqual(defaultGameSettings);
  expect(parseGameSettings('{"musicVolume":999,"sfxVolume":-2,"keyboardLayout":0,"isFullscreen":true}'))
    .toEqual({textSize: 100, musicVolume: 100, sfxVolume: 0, keyboardLayout: 0, isFullscreen: true});
});


test('text size accepts supported choices and safely restores older or invalid settings', () => {
  for (const textSize of [100, 115, 130] as const) expect(parseGameSettings(JSON.stringify({textSize})).textSize).toBe(textSize);
  for (const textSize of [null, '130', -1, 0, 1000]) expect(parseGameSettings(JSON.stringify({textSize})).textSize).toBe(100);
  expect(parseGameSettings('{}').textSize).toBe(100);
});
