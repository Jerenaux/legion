const path = require('node:path');

// steamworks.js 0.4 lacks GetLaunchQueryParam. Read it from the same SDK library
// after steamworks.js initializes it; never create a second Steam client.
function createSteamLaunchReader(steamworksRoot) {
  const library = {darwin: 'osx/libsteam_api.dylib', win32: 'win64/steam_api64.dll', linux: 'linux64/libsteam_api.so'}[process.platform];
  if (!library) throw new Error('Unsupported Steam platform');
  const sdk = require('koffi').load(path.join(steamworksRoot, 'dist', library));
  const apps = sdk.func('void *SteamAPI_SteamApps_v008()');
  const query = sdk.func('const char *SteamAPI_ISteamApps_GetLaunchQueryParam(void *self, const char *key)');
  return key => {
    const pointer = apps();
    return pointer ? query(pointer, key) : null;
  };
}

module.exports = {createSteamLaunchReader};
