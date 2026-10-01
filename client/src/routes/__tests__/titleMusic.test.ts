import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../TitleScreen.tsx', import.meta.url), 'utf8'), {
  compilerOptions: {jsx: ts.JsxEmit.React, jsxFactory: 'h', module: ts.ModuleKind.CommonJS},
}).outputText;

test('title music loops at the saved volume, retries blocked autoplay, and stops on leaving', async () => {
  const events = new EventEmitter();
  const document = new EventEmitter();
  const settings = {musicVolume: 25};
  let effect: () => () => void;
  let plays = 0;
  let pauses = 0;
  let released = false;
  const audio = {
    paused: true, loop: false, volume: 1,
    play: async () => {
      plays++;
      if (plays === 1) throw new Error('Autoplay blocked');
      audio.paused = false;
    },
    pause: () => { pauses++; audio.paused = true; },
    removeAttribute: (name: string) => { expect(name).toBe('src'); },
    load: () => { released = true; },
  };
  const exports = {} as {default: () => unknown};
  runInNewContext(code, {
    exports, Audio: function(src: string) { expect(src).toBe('title.wav'); return audio; },
    document: {addEventListener: document.on.bind(document), removeEventListener: document.off.bind(document)},
    require: (name: string) => {
      if (name === 'preact') return {h: () => null};
      if (name === 'preact/hooks') return {useContext: () => ({loaded: true, player: {}}), useEffect: (callback: typeof effect) => {effect = callback;}};
      if (name === '../settings') return {loadGameSettings: () => settings};
      if (name === '../components/HUD/GameHUD') return {events};
      if (name.endsWith('title.wav')) return {default: 'title.wav'};
      if (name.endsWith('package.json')) return {version: 'test'};
      return {};
    },
  });
  exports.default();
  const cleanup = effect!();
  await Promise.resolve();
  expect(audio.loop).toBe(true);
  expect(audio.volume).toBe(0.25);
  document.emit('pointerdown');
  await Promise.resolve();
  expect(plays).toBe(2);
  document.emit('keydown');
  expect(plays).toBe(2);
  settings.musicVolume = 0;
  events.emit('settingsChanged');
  expect(audio.volume).toBe(0);
  settings.musicVolume = 100;
  events.emit('settingsChanged');
  expect(audio.volume).toBe(1);
  cleanup();
  expect(pauses).toBe(1);
  expect(released).toBe(true);
  expect(events.listenerCount('settingsChanged')).toBe(0);
  expect(document.listenerCount('pointerdown')).toBe(0);
  expect(document.listenerCount('keydown')).toBe(0);
});
