import {expect, test} from 'bun:test';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../../titleMusic.ts', import.meta.url), 'utf8'), {
  compilerOptions: {target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'h', module: ts.ModuleKind.CommonJS},
}).outputText;

test('title music loops at the saved volume, retries blocked autoplay, and stops on leaving', async () => {
  const events = new EventEmitter();
  const document = new EventEmitter();
  const settings = {musicVolume: 25};
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
  const exports = {} as {startTitleMusic: () => () => void};
  runInNewContext(code, {
    exports, Audio: function(src: string) { expect(src).toBe('title.mp3'); return audio; },
    document: {addEventListener: document.on.bind(document), removeEventListener: document.off.bind(document)},
    require: (name: string) => {
      if (name === './settings') return {loadGameSettings: () => settings};
      if (name === './components/HUD/GameHUD') return {events};
      if (name.endsWith('title.mp3')) return {default: 'title.mp3'};
      if (name.endsWith('package.json')) return {version: 'test'};
      return {};
    },
  });
  const cleanup = exports.startTitleMusic();
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

test('app starts music before authentication, retains it on the title route, and stops it elsewhere', () => {
  const appCode = ts.transpileModule(readFileSync(new URL('../../app.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'h', module: ts.ModuleKind.CommonJS},
  }).outputText;
  let starts = 0;
  let stops = 0;
  const exports = {} as {default: new () => import('../../app').default};
  runInNewContext(appCode, {
    exports, URL, location: {pathname: '/', href: 'app://legion/'}, process: {env: {}},
    document: {addEventListener() {}, removeEventListener() {}},
    window: {addEventListener() {}, removeEventListener() {}},
    fetch: () => Promise.resolve(),
    require: (name: string) => {
      if (name === 'preact') return {Component: class {
        state: Record<string, unknown>;
        setState(state: Record<string, unknown>) {Object.assign(this.state, state);}
      }};
      if (name === './titleMusic') return {startTitleMusic: () => {starts++; return () => {stops++;};}};
      if (name === './services/firebaseService') return {firebaseAuth: {currentUser: null}};
      if (name === './components/withAuth') return {default: (component: unknown) => component};
      if (name === './input/gamepad') return {startGamepadInput: () => () => {}};
      return {};
    },
  });
  const app = new exports.default();
  app.componentDidMount();
  expect(starts).toBe(1); // Firebase has no authenticated user yet.
  const noop = () => {};
  app.handleRoute({url: '/?loading'} as never, noop, noop);
  expect(starts).toBe(1);
  expect(stops).toBe(0);
  app.handleRoute({url: '/play'} as never, noop, noop);
  expect(stops).toBe(1);
  app.handleRoute({url: '/'} as never, noop, noop);
  expect(starts).toBe(2);
  app.componentWillUnmount();
  expect(stops).toBe(2);
});
