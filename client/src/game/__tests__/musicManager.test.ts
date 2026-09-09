import {expect, mock, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Exercise the real controller without importing the HUD or producing audio.
const code = ts.transpileModule(readFileSync(new URL('../MusicManager.ts', import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS},
}).outputText;

function setup() {
  const events = new EventEmitter();
  const settings = {musicVolume: 0};
  const exports = {} as {MusicManager: typeof import('../MusicManager').MusicManager};
  runInNewContext(code, {exports, require: (name: string) => {
    if (name === '../components/HUD/GameHUD') return {events};
    if (name === '../settings') return {loadGameSettings: () => settings};
    throw new Error(`Unexpected music dependency: ${name}`);
  }});
  const available = new Set(['bgm_start', 'bgm_end', ...Array.from({length: 12}, (_, i) => `bgm_loop_${i + 1}`)]);
  const played: string[] = [];
  const scene = {
    cache: {audio: {has: (key: string) => available.has(key)}},
    sound: {
      add: (key: string) => {
        expect(available.has(key)).toBe(true);
        return Object.assign(new EventEmitter(), {
          key, play: () => played.push(key), stop: mock(), setVolume: mock(),
        });
      },
      removeAll: mock(),
    },
  };
  const manager = new exports.MusicManager(scene, 1, 12, [5, 6, 11]);
  const complete = (times = 1) => {
    for (let i = 0; i < times; i++) manager.currentSound.emit('complete');
  };
  manager.playBeginning();
  return {manager, complete, played, available, events, settings, scene};
}

test('the intro is separate, and each combat track plays five times before advancing', () => {
  const {manager, complete, played} = setup();
  expect(played).toEqual(['bgm_start']);
  complete();
  for (const intensity of [1, 2, 3]) {
    expect(manager.currentSound.key).toBe(`bgm_loop_${intensity}`);
    complete(4);
    expect(manager.currentSound.key).toBe(`bgm_loop_${intensity}`);
    expect(played.filter(key => key === `bgm_loop_${intensity}`)).toHaveLength(5);
    complete();
    expect(manager.currentSound.key).toBe(`bgm_loop_${intensity + 1}`);
  }
});

for (const plays of [1, 5]) {
  test(`health takes priority after ${plays} plays and gives the new track a fresh counter`, () => {
    const {manager, complete} = setup();
    complete(plays);
    manager.updateMusicIntensity(0.5);
    expect(manager.currentSound.key).toBe('bgm_loop_1'); // Finish the current phrase.
    complete();
    expect(manager.currentSound.key).toBe('bgm_loop_7');
    manager.updateMusicIntensity(1); // Healing never reverses the existing intensity ramp.
    complete(4);
    expect(manager.currentSound.key).toBe('bgm_loop_7');
    complete();
    expect(manager.currentSound.key).toBe('bgm_loop_8');
  });
}

test('transition tracks play once and the final track never advances past the available score', () => {
  const {manager, complete, played} = setup();
  manager.updateMusicIntensity(0.75);
  complete(6);
  expect(played.slice(1)).toEqual([...Array(5).fill('bgm_loop_4'), 'bgm_loop_5']);
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_6');
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_7');
  manager.updateMusicIntensity(0);
  complete(12);
  expect(manager.currentSound.key).toBe('bgm_loop_12');
  expect(played).not.toContain('bgm_loop_13');
});

test('a delayed next asset keeps the current track playing and advances once loaded', () => {
  const {manager, complete, available} = setup();
  available.delete('bgm_loop_2');
  complete(7);
  expect(manager.currentSound.key).toBe('bgm_loop_1');
  available.add('bgm_loop_2');
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_2');
  complete(4);
  expect(manager.currentSound.key).toBe('bgm_loop_2');
});

test('volume changes and cleanup still work, and completion cannot restart combat music after game over', () => {
  const {manager, complete, played, settings, events, scene} = setup();
  complete(5);
  settings.musicVolume = 25;
  events.emit('settingsChanged');
  expect(manager.currentSound.setVolume).toHaveBeenCalledWith(0.25);
  manager.playEnd();
  expect(played.at(-1)).toBe('bgm_end');
  complete();
  expect(played.at(-1)).toBe('bgm_end');
  manager.destroy();
  expect(events.listenerCount('settingsChanged')).toBe(0);
  expect(scene.sound.removeAll).toHaveBeenCalledTimes(1);
});
