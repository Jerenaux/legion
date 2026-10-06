const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {giftFromArguments, createGiftQueue} = require('../gifts');
const token = 'a'.repeat(64);

test('only accepts exact gift tokens, not arbitrary launch commands or URLs', () => {
  expect(giftFromArguments(['app', `--legion-gift=${token}`])).toBe(token);
  expect(giftFromArguments([`legion://gift/${token}`])).toBe(token);
  for (const input of [`legion://evil/${token}`, `https://gift/${token}`, `legion://gift/${token}?run=bad`, '--legion-gift=../../bad', `--legion-gift=${token} extra`, `--legion-gift=${token.toUpperCase()}`]) {
    expect(giftFromArguments([input])).toBeNull();
  }
});

test('pending gifts survive restarts, deduplicate, and are removed only after acknowledgement', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-gifts-'));
  const file = path.join(dir, 'pending.json');
  try {
    const notify = jest.fn();
    const queue = createGiftQueue(file, notify);
    queue.add(token); queue.add(token); queue.add('bad');
    expect(notify).toHaveBeenCalledTimes(1);
    const restarted = createGiftQueue(file, notify);
    expect(restarted.peek()).toBe(token);
    restarted.add('b'.repeat(64));
    restarted.acknowledge(token);
    expect(createGiftQueue(file, notify).peek()).toBe('b'.repeat(64));
    restarted.acknowledge('b'.repeat(64));
    expect(createGiftQueue(file, notify).peek()).toBeNull();
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('native Steam launch reader binds the packaged SDK exports on this platform', () => {
  // Loads the real library without calling Steam before it is initialized.
  const {createSteamGiftReader} = require('../steam-launch');
  expect(typeof createSteamGiftReader(path.dirname(require.resolve('steamworks.js')))).toBe('function');
});
