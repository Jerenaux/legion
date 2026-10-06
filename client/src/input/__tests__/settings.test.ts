import { test, expect } from 'bun:test';
import {defaultGameSettings, musicGain, parseGameSettings, sfxGain} from "../../settings";

test("falls back safely when desktop settings are corrupt", () => {
  expect(parseGameSettings("not-json")).toEqual(defaultGameSettings);
  const saved = parseGameSettings('{"musicVolume":999,"sfxVolume":-2,"keyboardLayout":0,"isFullscreen":true}');
  expect(saved.musicVolume).toBe(100);
  expect(saved.sfxVolume).toBe(0);
});

test('text size accepts supported choices and safely restores older or invalid settings', () => {
  for (const textSize of [100, 115, 130] as const) expect(parseGameSettings(JSON.stringify({textSize})).textSize).toBe(textSize);
  for (const textSize of [null, '130', -1, 0, 1000]) expect(parseGameSettings(JSON.stringify({textSize})).textSize).toBe(100);
  expect(parseGameSettings('{}').textSize).toBe(100);
});

test('muting silences a channel without losing its volume', () => {
  const settings = parseGameSettings('{"musicVolume":40,"sfxVolume":80,"musicMuted":true}');
  expect(musicGain(settings)).toBe(0);
  expect(settings.musicVolume).toBe(40);
  expect(sfxGain(settings)).toBe(0.8);
  expect(musicGain({...settings, musicMuted: false})).toBe(0.4);
});
