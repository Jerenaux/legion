import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolveLocale, configureLocales, localizedAsset, initialize, t, formatNumber, userError, selectLanguage, language} from './core';

const locales = ['en', 'pt-BR', 'pt-PT', 'zh-Hans', 'zh-Hant', 'ja'].map(code => ({code, name: code, direction: 'ltr' as const}));

test('saved choice, language families, Chinese scripts and invalid preferences resolve consistently at startup', () => {
  const cases: [string[], string][] = [
    [['pt-PT', 'en-US'], 'pt-PT'], [['pt', 'en'], 'pt-BR'], [['pt-AO'], 'pt-BR'],
    [['zh-TW'], 'zh-Hant'], [['zh-HK'], 'zh-Hant'], [['zh-SG'], 'zh-Hans'],
    [['zh-Hant-CN'], 'zh-Hant'], [['xx', 'ja-JP'], 'ja'], [['bad_tag'], 'en'],
  ];
  const boot = require('../../tools/localization/build.cjs');
  // Use synthetic metadata so adding/removing shipped languages does not weaken the matcher test.
  const script = readFileSync(new URL('../../tools/localization/boot.js', import.meta.url), 'utf8')
    .replace('__LEGION_LOCALES__', JSON.stringify(Object.fromEntries(locales.map(l => [l.code, {...l, messages: {}}]))))
    .replace('__RESOLVE_LOCALE__', resolveLocale.toString());
  expect(boot(Buffer.from('__LEGION_LOCALES__; __RESOLVE_LOCALE__'))).not.toContain('__LEGION_');
  for (const [preferences, expected] of cases) {
    expect(resolveLocale(preferences, locales)).toBe(expected);
    const document = {documentElement: {lang: ''}, querySelectorAll: () => []};
    runInNewContext(script, {document, window: {}, Intl, localStorage: {getItem: () => preferences[0]}, navigator: {languages: preferences.slice(1)}});
    expect(document.documentElement.lang).toBe(expected);
  }
});

test('catalog plurals and fallback preserve numeric values, names and optional artwork', () => {
  const en = require('../../locales/en/messages.json');
  const pt = require('../../locales/pt-PT/messages.json');
  initialize({en: {translation: {...en, unsafe: '{{name}}', onlyEnglish: 'English fallback',
    sample_one: '{{count}} item', sample_other: '{{count}} items'}},
    'pt-PT': {translation: {...pt, sample_one: '{{count}} objeto', sample_other: '{{count}} objetos'}}}, 'pt-PT');
  expect(t('sample', {count: 1})).toBe('1 objeto');
  expect(t('sample', {count: 2})).toBe('2 objetos');
  expect(t('onlyEnglish')).toBe('English fallback');
  expect(t('unsafe', {name: '<img src=x>'})).toBe('<img src=x>'); // Text renderers escape this themselves.
  expect(t('unsafe', {name: '<img src=x>', interpolation: {escapeValue: true}})).toBe('&lt;img src=x&gt;');
  expect(formatNumber(12345.5)).toBe(new Intl.NumberFormat('pt-PT').format(12345.5));
  expect(userError(new Error('secret backend diagnostic'))).toBe(pt['Unable to complete the request. Please try again.']);
  configureLocales([{code: 'pt-PT', name: 'Português', direction: 'ltr', assetLanguage: 'pt-BR'}], 'pt-PT', {'pt-BR/title.png': '/portuguese.png', 'pt-PT/team.png': '/equipa.png'});
  expect(localizedAsset('title.png', '/original.png')).toBe('/portuguese.png');
  expect(localizedAsset('team.png', '/original.png')).toBe('/equipa.png');
  expect(localizedAsset('other.png', '/original.png')).toBe('/original.png');
  initialize({en: {translation: en}}, 'en');
  configureLocales([], 'en', {});
});

test('native dialog catalog accepts only discovered locales', () => {
  const native = require('../../electron/localization');
  expect(native.setLanguage('../../private')).toBe(false);
  expect(native.setLanguage(null)).toBe(false);
  expect(native.setLanguage('pt-PT')).toBe(true);
  expect(native.t('Reload game')).toBe(require('../../locales/pt-PT/messages.json')['Reload game']);
  native.useSystemLanguages(['en-US']);
  expect(native.t('Reload game')).toBe('Reload game');
});

test('live language changes load fonts first, preserve the document, and reject unsafe or failed switches', async () => {
  const globals = ['window', 'document', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  const selected: string[] = [];
  const style = new Map<string, string>();
  const location = {pathname: '/play', reload: () => { throw new Error('Language switching must not reload'); }};
  const root = {lang: 'en', dir: 'ltr', style: {setProperty: (k: string, v: string) => style.set(k, v), removeProperty: (k: string) => style.delete(k)}};
  let loadFont: () => Promise<unknown> = () => Promise.resolve();
  try {
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {location}});
    Object.defineProperty(globalThis, 'document', {configurable: true, value: {documentElement: root, fonts: {load: () => loadFont()}}});
    Object.defineProperty(globalThis, 'localStorage', {configurable: true, value: {setItem: (_key: string, value: string) => selected.push(value)}});
    configureLocales([{code: 'en', name: 'English', direction: 'ltr'}, {code: 'ja', name: '日本語', direction: 'ltr', fontFamily: 'Noto Sans JP'}], 'en', {'ja/title.png': '/japanese.png'});
    initialize({en: {translation: {Play: 'Play'}}, ja: {translation: {Play: 'プレイ'}}}, 'en');
    let resolveFont: () => void;
    loadFont = () => new Promise<void>(resolve => { resolveFont = resolve; });
    const change = selectLanguage('ja');
    expect(t('Play')).toBe('Play');
    expect(selected).toEqual([]);
    resolveFont!();
    await change;
    expect(t('Play')).toBe('プレイ');
    expect(language).toBe('ja');
    expect(root.lang).toBe('ja');
    expect(style.get('--locale-font')).toBe('Noto Sans JP');
    expect(localizedAsset('title.png', '/english.png')).toBe('/japanese.png');
    expect(selected).toEqual(['ja']);
    for (const path of ['/game/1', '/replay/1', '/queue/casual', '/lobby/1']) {
      location.pathname = path;
      await selectLanguage('en');
      expect(language).toBe('ja');
    }
    location.pathname = '/play';
    await selectLanguage('en');
    expect(t('Play')).toBe('Play');
    expect(style.has('--locale-font')).toBe(false);
    loadFont = () => Promise.reject(new Error('Font unavailable'));
    await expect(selectLanguage('ja')).rejects.toThrow('Font unavailable');
    expect(language).toBe('en');
    await selectLanguage('../../private');
    expect(language).toBe('en');
    loadFont = () => new Promise<void>(resolve => { resolveFont = resolve; });
    const interrupted = selectLanguage('ja');
    location.pathname = '/game/1';
    resolveFont!();
    await interrupted;
    expect(language).toBe('en');
  } finally {
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    initialize({en: {translation: require('../../locales/en/messages.json')}}, 'en');
    configureLocales([], 'en', {});
  }
});


test('Steam metadata aliases obey saved choice > Steam > OS in renderer, startup and native recovery', () => {
  const codes = ['en', 'pt-BR', 'pt-PT', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'de', 'es'];
  const shipped = codes.map(code => ({...require(`../../locales/${code}/locale.json`), code}));
  const script = require('../../tools/localization/build.cjs')(readFileSync(new URL('../../tools/localization/boot.js', import.meta.url)));
  const native = require('../../electron/localization');
  const cases = [
    {saved: 'pt-BR', steam: 'portuguese', os: 'ja-JP', expected: 'pt-BR'},
    {saved: '', steam: 'portuguese', os: 'pt-BR', expected: 'pt-PT'},
    {saved: '', steam: 'brazilian', os: 'pt-PT', expected: 'pt-BR'},
    {saved: 'zh-Hant', steam: 'schinese', os: 'en', expected: 'zh-Hant'},
    {saved: '', steam: 'schinese', os: 'zh-TW', expected: 'zh-Hans'},
    {saved: '', steam: 'tchinese', os: 'zh-CN', expected: 'zh-Hant'},
    {saved: '', steam: 'koreana', os: 'en', expected: 'ko'},
    {saved: '', steam: 'latam', os: 'en', expected: 'es'},
    {saved: '', steam: 'english', os: 'ja', expected: 'en'},
    {saved: '', steam: 'unsupported', os: 'ja-JP', expected: 'ja'},
    {saved: 'invalid_tag', steam: '', os: 'pt-PT', expected: 'pt-PT'},
    {saved: '', steam: '', os: 'zh-HK', expected: 'zh-Hant'},
    {saved: '', steam: '', os: 'unsupported', expected: 'en'},
  ];
  for (const {saved, steam, os, expected} of cases) {
    expect(resolveLocale([saved, steam, os], shipped)).toBe(expected);
    const document = {documentElement: {lang: ''}, querySelectorAll: () => []};
    const selected: string[] = [];
    runInNewContext(script, {document, Intl, window: {electronAPI: {
      steamLanguage: steam, setLanguage: (code: string) => { selected.push(code); return Promise.resolve(true); },
    }}, localStorage: {getItem: () => saved}, navigator: {languages: [os]}});
    expect(document.documentElement.lang).toBe(expected);
    expect(selected).toEqual([expected]);
    native.useSystemLanguages([saved, steam, os]);
    expect(native.t('Reload game')).toBe(require(`../../locales/${expected}/messages.json`)['Reload game']);
  }
  for (const locale of shipped) {
    for (const alias of locale.steamLanguages) expect(resolveLocale([alias, 'en'], shipped)).toBe(locale.code);
  }
  native.setLanguage('en');
});
