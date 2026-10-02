import {createInstance, type TOptions} from 'i18next';

export interface Locale {
  code: string;
  name: string;
  direction: 'ltr' | 'rtl';
  fontFamily?: string;
  assetLanguage?: string;
}

export const resolveLocale: (preferences: readonly string[], locales: readonly Locale[]) => string = require('../../electron/locale').resolveLocale;

export const i18n = createInstance();
i18n.use({
  type: 'formatter',
  init() {},
  format: (value: unknown, _format: string, locale: string) => typeof value === 'number' ? new Intl.NumberFormat(locale).format(value) : String(value),
});
export let locales: Locale[] = [];
export let language = 'en';
export const fontFamily = () => `${locales.find(locale => locale.code === language)?.fontFamily || 'Kim'}, system-ui, sans-serif`;
export const LANGUAGE_STORAGE_KEY = 'legion.language';
let assets: Record<string, string> = {};

export function configureLocales(available: Locale[], selected: string, artwork: Record<string, string>) {
  locales = available;
  language = selected;
  assets = artwork;
}

export function localizedAsset(path: string, fallback: string): string {
  for (const code of [language, locales.find(locale => locale.code === language)?.assetLanguage, language.split('-')[0], 'en'].filter(Boolean)) {
    if (assets[`${code}/${path}`]) return assets[`${code}/${path}`];
  }
  return fallback;
}

export function selectLanguage(code: string) {
  if (!locales.some(locale => locale.code === code)) return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  window.location.reload();
}

export function initialize(resources: Record<string, {translation: Record<string, string>}>, language: string) {
  void i18n.init({
    resources, supportedLngs: Object.keys(resources), lng: language, fallbackLng: 'en', initAsync: false,
    keySeparator: false, nsSeparator: false, returnEmptyString: false,
    // Preact and Phaser render text; rich messages use Trans's component allowlist.
    interpolation: {escapeValue: false, alwaysFormat: true},
  });
}

export function t(key: string, options?: TOptions): string {
  return String(i18n.t(key, options));
}

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) =>
  Number.isFinite(value) ? new Intl.NumberFormat(i18n.resolvedLanguage || 'en', options).format(value) : '—';

export const formatDate = (value: Date, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(i18n.resolvedLanguage || 'en', options).format(value);

// Pure module also works in tools and unit tests without Webpack or browser globals.
initialize({}, 'en');

export function userError(value: unknown): string {
  const message = value instanceof Error ? value.message : typeof value === 'string' ? value : '';
  return t(i18n.exists(message) ? message : 'Unable to complete the request. Please try again.');
}
