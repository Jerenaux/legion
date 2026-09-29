const {test, expect} = require('bun:test');
const {EventEmitter} = require('node:events');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const path = require('node:path');

test('native crash recovery offers one reload, respects close and never prompts on normal exit', async () => {
  let finishPrompt;
  let prompts = 0;
  let reloads = 0;
  let closes = 0;
  const module = {exports: {}};
  runInNewContext(readFileSync(path.join(__dirname, '../recovery.js'), 'utf8'), {
    module, require: () => ({dialog: {showMessageBox: () => {
      prompts++;
      return new Promise(resolve => {finishPrompt = resolve;});
    }}}),
  });
  const webContents = Object.assign(new EventEmitter(), {reload: () => {reloads++;}});
  module.exports.installRendererRecovery({webContents, isDestroyed: () => false, close: () => {closes++;}});
  webContents.emit('render-process-gone', {}, {reason: 'clean-exit'});
  expect(prompts).toBe(0);
  const handler = webContents.listeners('render-process-gone')[0];
  const reload = handler({}, {reason: 'oom'});
  await handler({}, {reason: 'crashed'});
  expect(prompts).toBe(1);
  finishPrompt({response: 0});
  await reload;
  expect(reloads).toBe(1);
  const close = handler({}, {reason: 'crashed'});
  finishPrompt({response: 1});
  await close;
  expect(closes).toBe(1);
});
