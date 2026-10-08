const path = require('node:path');

test('native Steam launch reader binds the packaged SDK exports on this platform', () => {
  // Loads the real library without calling Steam before it is initialized.
  const {createSteamLaunchReader} = require('../steam-launch');
  expect(typeof createSteamLaunchReader(path.dirname(require.resolve('steamworks.js')))).toBe('function');
});
