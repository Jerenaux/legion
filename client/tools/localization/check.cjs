const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.join(__dirname, '../../locales');
const english = JSON.parse(fs.readFileSync(path.join(root, 'en/messages.json'), 'utf8'));
const directories = fs.readdirSync(root).filter(code => fs.existsSync(path.join(root, code, 'locale.json')));
const tokens = value => (value.match(/{{[^{}]+}}|<[^>]+>/g) || []).sort();
const plural = /_(zero|one|two|few|many|other)$/;
const errors = [];
function check(condition, message) { if (!condition) errors.push(message); }

for (const code of directories) {
  const metadata = JSON.parse(fs.readFileSync(path.join(root, code, 'locale.json'), 'utf8'));
  const messages = JSON.parse(fs.readFileSync(path.join(root, code, 'messages.json'), 'utf8'));
  check(Intl.getCanonicalLocales(code)[0] === code, `${code}: use a canonical BCP 47 folder name`);
  check(typeof metadata.name === 'string' && metadata.name.length > 0 && ['ltr', 'rtl'].includes(metadata.direction), `${code}: invalid locale metadata`);
  if (metadata.assetLanguage) check(directories.includes(metadata.assetLanguage) && metadata.assetLanguage !== code, `${code}: invalid assetLanguage`);
  for (const key of Object.keys(english)) {
    if (!plural.test(key)) check(typeof messages[key] === 'string' && messages[key].trim(), `${code}: missing ${key}`);
    else {
      for (const category of new Intl.PluralRules(code).resolvedOptions().pluralCategories) {
        const form = key.replace(plural, `_${category}`);
        check(typeof messages[form] === 'string' && messages[form].trim(), `${code}: missing ${form}`);
      }
    }
  }
  for (const [key, value] of Object.entries(messages)) {
    const original = english[key] ?? english[key.replace(plural, '_other')];
    check(typeof value === 'string', `${code}: non-text ${key}`);
    if (original === undefined || typeof value !== 'string') { check(false, `${code}: unknown key ${key}`); continue; }
    try { assert.deepEqual(tokens(value), tokens(original)); }
    catch { check(false, `${code}: changed placeholders or markup in ${key}`); }
    const stack = [];
    for (const tag of value.match(/<[^>]+>/g) || []) {
      check(/^<\/?\d+\s*\/?>$|^<\/?(?:strong|em|b|i)>$|^<br\s*\/?>$|^<span class="highlight-text">$|^<\/span>$/.test(tag), `${code}: unsafe markup ${tag} in ${key}`);
      if (/^<\//.test(tag)) check(stack.pop() === tag.slice(2, -1), `${code}: mismatched markup in ${key}`);
      else if (!/\/>$|^<br/.test(tag)) stack.push(tag.match(/^<([^ >]+)/)[1]);
    }
    check(!stack.length, `${code}: unclosed markup in ${key}`);
  }
}
// Catch newly added literal translation keys before English or another locale ships incomplete.
const src = path.join(__dirname, '../../src');
for (const name of fs.readdirSync(src, {recursive: true}).filter(name => /\.tsx?$/.test(name) && !name.includes('__tests__') && !name.endsWith('.test.ts'))) {
  const source = ts.createSourceFile(name, fs.readFileSync(path.join(src, name), 'utf8'), ts.ScriptTarget.Latest, true);
  const checkKey = node => {
    if (!node) return;
    if (ts.isConditionalExpression(node)) {checkKey(node.whenTrue); checkKey(node.whenFalse);}
    else if (ts.isStringLiteralLike(node)) check(node.text in english || `${node.text}_other` in english, `${name}: missing English key ${node.text}`);
  };
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 't') checkKey(node.arguments[0]);
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'i18nKey') checkKey(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer);
    ts.forEachChild(node, visit);
  };
  visit(source);
}
// Display data is shared with the server; localize it only where it is rendered.
for (const name of ['Items.ts', 'Spells.ts', 'Equipments.ts', 'tower.ts']) {
  const source = ts.createSourceFile(name, fs.readFileSync(path.join(__dirname, '../../../shared', name), 'utf8'), ts.ScriptTarget.Latest, true);
  const visit = node => {
    if (ts.isPropertyAssignment(node) && ['name', 'description'].includes(node.name.getText(source)) && ts.isStringLiteralLike(node.initializer) && node.initializer.text) {
      check(node.initializer.text in english, `${name}: missing display-data key ${node.initializer.text}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
if (errors.length) { console.error([...new Set(errors)].join('\n')); process.exitCode = 1; }
else console.log(`${directories.length} locales: catalog coverage, plurals, placeholders, markup and source keys pass`);
