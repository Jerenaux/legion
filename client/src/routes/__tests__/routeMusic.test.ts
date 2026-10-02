import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../../routeMusic.ts', import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.CommonJS},
}).outputText;

function setup(blockAutoplay = false) {
  const events = new EventEmitter();
  const document = new EventEmitter();
  const settings = {musicVolume: 25};
  let now = 0;
  const timers = new Set<() => void>();
  const tracks: Audio[] = [];
  class Audio {
    paused = true;
    loop = false;
    volume = 1;
    released = false;
    constructor(public src: string) {tracks.push(this);}
    async play() {
      if (blockAutoplay) {blockAutoplay = false; throw new Error('Autoplay blocked');}
      this.paused = false;
    }
    pause() {this.paused = true;}
    removeAttribute() {this.src = '';}
    load() {this.released = true;}
  }
  const exports = {} as typeof import('../../routeMusic');
  runInNewContext(code, {
    exports, Audio, performance: {now: () => now},
    setInterval: (callback: () => void) => {timers.add(callback); return callback;},
    clearInterval: (callback: () => void) => timers.delete(callback),
    document: {addEventListener: document.on.bind(document), removeEventListener: document.off.bind(document)},
    require: (name: string) => {
      if (name === './settings') return {loadGameSettings: () => settings};
      if (name === './components/HUD/GameHUD') return {events};
      return {default: name};
    },
  });
  const advance = (ms: number) => {now += ms; for (const tick of [...timers]) tick();};
  return {...exports, tracks, events, document, settings, advance, timers};
}

test('title fades before looping menus, menu navigation preserves playback, and combat waits for silence', async () => {
  const music = setup(true);
  await music.setRouteMusic('/');
  const title = music.tracks[0];
  expect(title.loop).toBe(true);
  expect(title.volume).toBe(0);
  music.document.emit('pointerdown');
  await Promise.resolve();
  expect(title.paused).toBe(false);
  music.advance(250);
  expect(title.volume).toBe(.125);
  music.advance(250);
  expect(title.volume).toBe(.25);
  const menusReady = music.setRouteMusic('/play');
  music.advance(1000);
  expect(title.volume).toBe(.125);
  expect(music.tracks).toHaveLength(1);
  music.settings.musicVolume = 50;
  music.events.emit('settingsChanged');
  expect(title.volume).toBe(.25); // Live volume changes preserve the fade gain.
  music.advance(1000);
  await menusReady;
  const menus = music.tracks[1];
  expect(title.released).toBe(true);
  expect(title.paused).toBe(true);
  expect(menus.src).toEndWith('/menus.mp3');
  expect(menus.loop).toBe(true);
  expect(menus.volume).toBe(0);
  music.advance(250);
  expect(menus.volume).toBe(.25);
  music.advance(250);
  expect(menus.volume).toBe(.5);
  for (const route of ['/shop', '/team/1', '/rank', '/guide', '/queue/casual', '/lobby/1']) await music.setRouteMusic(route);
  expect(music.tracks).toHaveLength(2);
  let combatReady = false;
  const ready = music.setRouteMusic('/game/123').then(() => {combatReady = true;});
  music.advance(1000);
  await Promise.resolve();
  expect(combatReady).toBe(false);
  expect(menus.paused).toBe(false);
  music.advance(1000);
  await ready;
  expect(combatReady).toBe(true);
  expect(menus.paused).toBe(true);
  expect(menus.released).toBe(true);
  await music.setRouteMusic('/replay/123');
  expect(music.tracks).toHaveLength(2);
  expect(music.events.listenerCount('settingsChanged')).toBe(0);
  expect(music.document.listenerCount('pointerdown')).toBe(0);
  expect(music.document.listenerCount('keydown')).toBe(0);
  expect(music.timers.size).toBe(0);
});

test('rapid navigation uses the latest destination and unmount cancels pending playback', async () => {
  const music = setup();
  await music.setRouteMusic('/');
  music.advance(500);
  const fade = music.setRouteMusic('/play');
  expect(music.setRouteMusic('/game/1')).toBe(fade);
  music.advance(2000);
  await fade;
  expect(music.tracks).toHaveLength(1); // The skipped menu never starts.
  await music.setRouteMusic('/team');
  expect(music.tracks[1].paused).toBe(false);
  music.advance(500);
  const leaving = music.setRouteMusic('/');
  music.stopRouteMusic();
  await leaving;
  music.advance(2000);
  expect(music.tracks).toHaveLength(2);
  expect(music.tracks.every(track => track.paused && track.released)).toBe(true);
  expect(music.timers.size).toBe(0);
  expect(music.events.listenerCount('settingsChanged')).toBe(0);
});

test('direct combat starts no menu music, and muted transitions do not delay combat', async () => {
  const music = setup();
  await music.setRouteMusic('/game/1');
  expect(music.tracks).toHaveLength(0);
  music.settings.musicVolume = 0;
  await music.setRouteMusic('/play');
  expect(music.tracks[0].volume).toBe(0);
  await music.setRouteMusic('/replay/1');
  expect(music.tracks[0].paused).toBe(true);
  expect(music.timers.size).toBe(0);
});

test('app starts route music before authentication and forwards navigation and teardown', () => {
  const appCode = ts.transpileModule(readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'h', module: ts.ModuleKind.CommonJS},
  }).outputText;
  const routes: string[] = [];
  let stops = 0;
  const exports = {} as {default: new () => import('../../app').default};
  runInNewContext(appCode, {
    exports, URL, location: {pathname: '/', href: 'app://legion/'}, process: {env: {}},
    document: {addEventListener() {}, removeEventListener() {}},
    window: {addEventListener() {}, removeEventListener() {}}, fetch: () => Promise.resolve(),
    require: (name: string) => {
      if (name === 'preact') return {Component: class {
        state: Record<string, unknown>;
        setState(state: Record<string, unknown>) {Object.assign(this.state, state);}
      }};
      if (name === './routeMusic') return {setRouteMusic: (path: string) => {routes.push(path); return Promise.resolve();}, stopRouteMusic: () => {stops++;}};
      if (name === './services/firebaseService') return {firebaseAuth: {currentUser: null}};
      if (name === './components/withAuth') return {default: (component: unknown) => component};
      if (name === './input/gamepad') return {startGamepadInput: () => () => {}};
      return {};
    },
  });
  const app = new exports.default();
  app.componentDidMount();
  expect(routes).toEqual(['/']);
  const noop = () => {};
  for (const url of ['/?loading', '/play', '/game/123', '/replay/123']) app.handleRoute({url} as never, noop, noop);
  expect(routes).toEqual(['/', '/', '/play', '/game/123', '/replay/123']);
  app.componentWillUnmount();
  expect(stops).toBe(1);
});


test('a match ending during the fade waits before its finale and cancels on teardown', async () => {
  const source = ts.createSourceFile('Arena.ts', readFileSync(new URL('../../game/Arena.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const method = source.statements.find(ts.isClassDeclaration)!.members.find(member => member.name?.getText(source) === 'processGameEnd')!;
  const code = ts.transpileModule(`new class {${method.getText(source)}}`, {compilerOptions: {target: ts.ScriptTarget.ESNext}}).outputText;
  for (const disposed of [false, true]) {
    let finishFade: () => void;
    let finales = 0;
    const fade = new Promise<void>(resolve => {finishFade = resolve;});
    const arena = runInNewContext(code, {setRouteMusic: () => fade});
    arena.playerTeamId = 1;
    arena.musicManager = {gameOver: false, playEnd: () => {finales++;}};
    arena.teamsMap = new Map();
    arena.time = {delayedCall() {}};
    arena.processGameEnd({isWinner: true});
    expect(arena.musicManager.gameOver).toBe(true);
    expect(finales).toBe(0);
    arena.disposed = disposed;
    finishFade!();
    await fade;
    expect(finales).toBe(disposed ? 0 : 1);
  }
});


test('leaving during fade-in fades from the current volume and cancels its timer', async () => {
  const music = setup();
  await music.setRouteMusic('/');
  music.advance(250);
  expect(music.tracks[0].volume).toBe(.125);
  const ready = music.setRouteMusic('/game/1');
  music.advance(1000);
  expect(music.tracks[0].volume).toBe(.0625);
  music.advance(1000);
  await ready;
  expect(music.tracks[0].released).toBe(true);
  expect(music.timers.size).toBe(0);
  await music.setRouteMusic('/play');
  music.stopRouteMusic();
  music.advance(500);
  expect(music.timers.size).toBe(0);
});
