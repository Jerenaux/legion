const fs = require('node:fs');
const path = require('node:path');
const validToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

function giftFromArguments(args) {
  for (const value of args) {
    if (value.startsWith('--legion-gift=')) {
      const token = value.slice('--legion-gift='.length);
      if (validToken(token)) return token;
    }
    // The local/direct-download link uses the OS protocol, not an app:// route.
    const match = /^legion:\/\/gift\/([a-f0-9]{64})$/.exec(value);
    if (match) return match[1];
  }
  return null;
}

function createGiftQueue(file, notify) {
  let pending = [];
  try { pending = JSON.parse(fs.readFileSync(file, 'utf8')).filter(validToken).slice(0, 20); } catch { /* First launch. */ }
  const save = () => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(`${file}.tmp`, JSON.stringify(pending), {mode: 0o600});
    fs.renameSync(`${file}.tmp`, file);
  };
  return {
    peek: () => pending[0] || null,
    add(token) {
      if (!validToken(token) || pending.includes(token) || pending.length >= 20) return;
      pending.push(token); save(); notify();
    },
    acknowledge(token) {
      if (!validToken(token)) return;
      pending = pending.filter(value => value !== token); save();
    },
  };
}

module.exports = {validToken, giftFromArguments, createGiftQueue};
