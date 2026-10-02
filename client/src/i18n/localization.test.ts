import {test, expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {resolveLocale, configureLocales, localizedAsset, initialize, t, formatNumber, userError} from './core';

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
    runInNewContext(script, {document, Intl, localStorage: {getItem: () => preferences[0]}, navigator: {languages: preferences.slice(1)}});
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
