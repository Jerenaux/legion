import {getElectronAPI} from '../utils/electronUtils';
import {initialize, resolveLocale, configureLocales, LANGUAGE_STORAGE_KEY, type Locale} from './core';
export {t, i18n, formatNumber, formatDate} from './core';

const catalogs = require.context('../../locales', true, /\/messages\.json$/);
const metadata = require.context('../../locales', true, /\/locale\.json$/);
const artwork = require.context('../../locales', true, /\/assets\/.*\.(png|jpe?g|svg|webp)$/);

export const locales: Locale[] = metadata.keys().map(key => ({
  ...metadata(key), code: key.split('/')[1],
})).sort((a, b) => a.name.localeCompare(b.name));

let saved = '';
try { saved = localStorage.getItem(LANGUAGE_STORAGE_KEY) || ''; } catch { /* Storage may be disabled. */ }
export const language = resolveLocale([saved, ...(navigator.languages || [navigator.language])], locales);
const resources = Object.fromEntries(catalogs.keys().map(key => [key.split('/')[1], {translation: catalogs(key)}]));
initialize(resources, language);
configureLocales(locales, language, Object.fromEntries(artwork.keys().map(key => [key.slice(2).replace('/assets/', '/'), artwork(key)])));

const locale = locales.find(locale => locale.code === language);
document.documentElement.lang = language;
document.documentElement.dir = locale?.direction || 'ltr';
if (locale?.fontFamily) document.documentElement.style.setProperty('--locale-font', locale.fontFamily);

void getElectronAPI()?.setLanguage?.(language).catch(() => {});

// Wait before creating canvas text; changing a CSS font cannot redraw Phaser textures.
const fonts = require.context('../../locales', true, /\/fonts\/.*\.(woff2?|otf|ttf)$/);
export const fontsReady = Promise.all(fonts.keys().map(key => {
  const fontLocale = locales.find(locale => locale.code === key.split('/')[1]);
  if (!fontLocale?.fontFamily) return undefined;
  const face = new FontFace(fontLocale.fontFamily, `url("${fonts(key)}")`, {weight: '100 900'});
  document.fonts.add(face);
  // Other faces load on demand, including native names in the language picker.
  return fontLocale.code === language ? face.load() : undefined;
}));
