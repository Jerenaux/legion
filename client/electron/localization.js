const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '../locales');
const catalogs = new Map(fs.readdirSync(root, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && fs.existsSync(path.join(root, entry.name, 'messages.json')))
  .map(entry => [entry.name, JSON.parse(fs.readFileSync(path.join(root, entry.name, 'messages.json'), 'utf8'))]));
let language = 'en';

function setLanguage(code) {
  if (typeof code !== 'string' || !catalogs.has(code)) return false;
  language = code;
  return true;
}

function useSystemLanguages(preferences) {
  setLanguage(require('./locale').resolveLocale(preferences, [...catalogs.keys()].map(code => ({code}))));
}

function t(key) {
  return catalogs.get(language)?.[key] || catalogs.get('en')?.[key] || key;
}

module.exports = {setLanguage, useSystemLanguages, t};
