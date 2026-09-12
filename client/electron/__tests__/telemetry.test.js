const {test, expect} = require('bun:test');
const {readFileSync} = require('node:fs');
const path = require('node:path');
const {runInNewContext} = require('node:vm');

function loadTelemetry(argv = []) {
  const calls = [];
  const Sentry = {init: options => calls.push(['init', options]),
    captureConsoleIntegration: () => ({}), childProcessIntegration: () => ({}), rendererEventLoopBlockIntegration: () => ({})};
  const module = {exports: {}};
  runInNewContext(readFileSync(path.join(__dirname, '../telemetry.js'), 'utf8'), {
    module, process: {env: {NODE_ENV: 'production'}, argv},
    require: name => ({'@sentry/electron/main': Sentry, '@sentry/node': {anrIntegration: () => ({})},
      './telemetry-options': {}, '../package.json': {version: 'test'}, 'node:path': path,
      'node:fs': {mkdirSync: directory => calls.push(['mkdir', directory])}})[name],
  });
  return {...module.exports, calls};
}

test('isolates crash storage before Sentry scans it, without touching inherited Steam dumps', () => {
  const {initializeTelemetry, calls} = loadTelemetry();
  const profile = path.resolve('test-profile');
  initializeTelemetry({isPackaged: true, getPath: name => {
    expect(name).toBe('userData'); return profile;
  }, setPath: (...args) => calls.push(['setPath', ...args])});
  expect(calls.map(call => call[0])).toEqual(['mkdir', 'setPath', 'init']);
  expect(calls[1]).toEqual(['setPath', 'crashDumps', path.join(profile, 'legion-crashpad')]);
  expect(calls[2][1].enabled).toBe(true);
});

test('only suppresses foreign Valve dumps and the exact known Electron warning', () => {
  const {filterDesktopEvent} = loadTelemetry();
  expect(filterDesktopEvent({contexts: {electron: {'crashpad.S-A': 'Valve'}}})).toBeNull();
  expect(filterDesktopEvent({logger: 'console', message: '(node:123) [DEP0180] DeprecationWarning: fs.Stats constructor is deprecated.'})).toBeNull();
  for (const event of [{message: 'Real failure'}, {message: "'renderer' process exited with 'crashed'"},
    {logger: 'console', message: '(node:123) [DEP9999] Another warning'}, {platform: 'native', contexts: {electron: {'crashpad.prod': 'Electron'}}}]) {
    expect(filterDesktopEvent(event)).toBe(event);
  }
});

test('packaged smoke checks cannot upload production telemetry', () => {
  const {initializeTelemetry, calls} = loadTelemetry(['Legion', '--smoke-test']);
  initializeTelemetry({isPackaged: true, getPath: () => path.resolve('test-profile'), setPath: () => {}});
  expect(calls.find(call => call[0] === 'init')[1].enabled).toBe(false);
});
