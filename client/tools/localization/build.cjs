const fs = require('node:fs');
const path = require('node:path');
module.exports = function(content) {
  const keys = ['Loading Legion', 'Reload game', 'If the arena doesn’t appear, reload the game. If it still won’t open, restart Legion or check for an update.'];
  const root = path.join(__dirname, '../../locales');
  const locales = Object.fromEntries(fs.readdirSync(root).filter(code => fs.existsSync(path.join(root, code, 'locale.json'))).map(code => {
    const metadata = JSON.parse(fs.readFileSync(path.join(root, code, 'locale.json'), 'utf8'));
    const messages = JSON.parse(fs.readFileSync(path.join(root, code, 'messages.json'), 'utf8'));
    return [code, {direction: metadata.direction, messages: Object.fromEntries(keys.map(key => [key, messages[key]]))}];
  }));
  return content.toString().replace('__LEGION_LOCALES__', JSON.stringify(locales)).replace('__RESOLVE_LOCALE__', require('../../electron/locale').resolveLocale.toString());
};
