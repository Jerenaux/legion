const fs = require('node:fs');

function validateSteamConfig(text, username) {
  const invalid = () => { throw new Error('Invalid Steam credential file; authenticate an isolated SteamCMD installation with the configured build account.'); };
  if (!username || Buffer.byteLength(text) > 65536) invalid();
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}]|\/\/[^\n]*|\S+/g)?.filter(token => !token.startsWith('//')) || [];
  let index = 0;
  const string = token => {
    if (!token?.startsWith('"') || !token.endsWith('"')) invalid();
    return token.slice(1, -1);
  };
  const object = () => {
    const result = Object.create(null);
    while (index < tokens.length && tokens[index] !== '}') {
      const key = string(tokens[index++]);
      if (Object.hasOwn(result, key)) invalid();
      const value = tokens[index++];
      if (value === '{') {
        result[key] = object();
        if (tokens[index++] !== '}') invalid();
      } else result[key] = string(value);
    }
    return result;
  };
  const root = object();
  if (index !== tokens.length) invalid();
  const config = root.InstallConfigStore;
  const steam = config?.Software?.Valve?.Steam;
  if (Object.keys(steam?.Accounts || {}).length !== 1 || !steam.Accounts[username]) invalid();
  const cache = Object.values(steam.ConnectCache || {});
  if (cache.length !== 1 || typeof cache[0] !== 'string' || !cache[0]) invalid();
  return [cache[0], config.Authentication?.RememberedMachineID].filter(value => typeof value === 'string' && value);
}

if (require.main === module) {
  try {
    const [mode, file] = process.argv.slice(2);
    if (!['validate', 'prepare'].includes(mode) || !file) throw new Error('Usage: node tools/steam-credentials.cjs <validate|prepare> <config.vdf>');
    if (mode === 'prepare' && (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_ENV)) throw new Error('Credential preparation is restricted to GitHub Actions.');
    const text = fs.readFileSync(file, 'utf8');
    const secrets = validateSteamConfig(text, process.env.STEAM_USERNAME);
    if (mode === 'prepare') {
      const encoded = Buffer.from(text).toString('base64');
      for (const secret of [...secrets, encoded]) console.log(`::add-mask::${secret.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')}`);
      fs.appendFileSync(process.env.GITHUB_ENV, `STEAM_CONFIG_VDF=${encoded}\n`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {validateSteamConfig};
