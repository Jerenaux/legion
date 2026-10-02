import {expect, mock, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Exercise the real controller without importing the HUD or producing audio.
const code = ts.transpileModule(readFileSync(new URL('../MusicManager.ts', import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS},
}).outputText;

function setup(deferBeginning = false) {
  const events = new EventEmitter();
  const settings = {musicVolume: 0};
  const exports = {} as {MusicManager: typeof import('../MusicManager').MusicManager};
  runInNewContext(code, {exports, require: (name: string) => {
    if (name === '../components/HUD/GameHUD') return {events};
    if (name === '../settings') return {loadGameSettings: () => settings};
    if (name.startsWith('@assets/music/')) return name;
    throw new Error(`Unexpected music dependency: ${name}`);
  }});
  const available = new Set(['bgm_start', 'bgm_loop_1']);
  const blocked = new Set<string>();
  const load = Object.assign(new EventEmitter(), {
    audio: (key: string) => {
      if (blocked.has(key)) return;
      available.add(key);
      load.emit(`filecomplete-audio-${key}`);
    }, start() {},
  });
  const played: string[] = [];
  type Fade = {targets: {musicGain: number}; duration: number; onUpdate: () => void; onComplete: () => void};
  const fades: (Fade & {remove: () => void})[] = [];
  const scene = {
    load,
    tweens: {add: (config: Fade) => {
      const tween = {...config, remove: mock()};
      fades.push(tween);
      return tween;
    }},
    cache: {audio: {has: (key: string) => available.has(key), getKeys: () => [...available], remove: (key: string) => available.delete(key)}},
    sound: {
      add: (key: string, config: {volume: number}) => {
        expect(available.has(key)).toBe(true);
        return Object.assign(new EventEmitter(), {
          key, initialVolume: config.volume, play: () => played.push(key), stop: mock(), setVolume: mock(), destroy: mock(),
        });
      },
      removeAll: mock(),
    },
  };
  const manager = new exports.MusicManager(scene, 1, 12, [5, 6, 11]);
  const complete = (times = 1) => {
    for (let i = 0; i < times; i++) manager.currentSound.emit('complete');
  };
  if (!deferBeginning) manager.playBeginning();
  return {manager, complete, played, available, blocked, events, settings, scene, fades};
}

test('the intro is separate, and each combat track plays twice before advancing', () => {
  const {manager, complete, played} = setup();
  expect(played).toEqual(['bgm_start']);
  complete();
  for (const intensity of [1, 2, 3]) {
    expect(manager.currentSound.key).toBe(`bgm_loop_${intensity}`);
    complete();
    expect(manager.currentSound.key).toBe(`bgm_loop_${intensity}`);
    expect(played.filter(key => key === `bgm_loop_${intensity}`)).toHaveLength(2);
    complete();
    expect(manager.currentSound.key).toBe(`bgm_loop_${intensity + 1}`);
  }
});

for (const plays of [1, 2]) {
  test(`health takes priority after ${plays} plays and gives the new track a fresh counter`, () => {
    const {manager, complete} = setup();
    complete(plays);
    manager.updateMusicIntensity(0.5);
    expect(manager.currentSound.key).toBe('bgm_loop_1'); // Finish the current phrase.
    complete();
    expect(manager.currentSound.key).toBe('bgm_loop_7');
    manager.updateMusicIntensity(1); // Healing never reverses the existing intensity ramp.
    complete();
    expect(manager.currentSound.key).toBe('bgm_loop_7');
    complete();
    expect(manager.currentSound.key).toBe('bgm_loop_8');
  });
}

test('transition tracks play once and the final track never advances past the available score', () => {
  const {manager, complete, played} = setup();
  manager.updateMusicIntensity(0.75);
  complete(3);
  expect(played.slice(1)).toEqual(['bgm_loop_4', 'bgm_loop_4', 'bgm_loop_5']);
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
  const {manager, complete, available, blocked} = setup();
  blocked.add('bgm_loop_2');
  complete(4);
  expect(manager.currentSound.key).toBe('bgm_loop_1');
  available.add('bgm_loop_2');
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_2');
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_2');
});

test('decoded music stays bounded to the playing track and its next transition', () => {
  const {manager, complete, available} = setup();
  for (let i = 0; i < 30; i++) {
    complete();
    expect(available.size).toBeLessThanOrEqual(2);
  }
  manager.playEnd();
  expect([...available]).toEqual(['bgm_end']);
});

test('a health jump during the intro retains a fallback until the requested audio arrives', () => {
  const {manager, complete, available, blocked} = setup();
  blocked.add('bgm_loop_7');
  manager.updateMusicIntensity(0.5);
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_1');
  available.add('bgm_loop_7');
  complete();
  expect(manager.currentSound.key).toBe('bgm_loop_7');
});

test('volume changes and cleanup still work, and completion cannot restart combat music after game over', () => {
  const {manager, complete, played, settings, events, scene} = setup();
  complete(2);
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


test('combat updates during the menu fade retain the intro until playback begins', () => {
  const {manager, available, played} = setup(true);
  manager.updateMusicIntensity(0.5);
  expect(available.has('bgm_start')).toBe(true);
  manager.playBeginning();
  expect(played).toEqual(['bgm_start']);
});


test('combat intro fades in, respects live volume, and cancels the fade on cleanup', () => {
  const {manager, fades, settings, events} = setup();
  expect(manager.currentSound.initialVolume).toBe(0);
  expect(fades[0].duration).toBe(500);
  fades[0].targets.musicGain = .5;
  settings.musicVolume = 50;
  events.emit('settingsChanged');
  expect(manager.currentSound.setVolume).toHaveBeenLastCalledWith(.25);
  fades[0].targets.musicGain = 1;
  fades[0].onUpdate();
  expect(manager.currentSound.setVolume).toHaveBeenLastCalledWith(.5);
  manager.playEnd();
  expect(fades[0].remove).toHaveBeenCalledTimes(1);
  expect(manager.currentSound.initialVolume).toBe(.5);
  const next = setup();
  next.manager.destroy();
  expect(next.fades[0].remove).toHaveBeenCalledTimes(1);
});
