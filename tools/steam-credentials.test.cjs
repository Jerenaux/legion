const assert = require('node:assert/strict');
const {test} = require('node:test');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const config = '"InstallConfigStore" { "Software" { "Valve" { "Steam" { "Accounts" { "builder" { "SteamID" "123" } } "ConnectCache" { "hash" "test-token" } } } } "Authentication" { "RememberedMachineID" "test-machine" } }';

test('prepares masked credentials only inside Actions and never prints them during validation', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'legion-steam-credential-test-'));
  try {
    const file = path.join(directory, 'config.vdf');
    const environment = path.join(directory, 'github-env');
    fs.writeFileSync(file, config);
    const run = (mode, actions) => spawnSync(process.execPath, [path.join(__dirname, 'steam-credentials.cjs'), mode, file], {
      encoding: 'utf8', env: {...process.env, STEAM_USERNAME: 'builder', GITHUB_ACTIONS: actions, GITHUB_ENV: environment},
    });
    const checked = run('validate', 'false');
    assert.equal(checked.status, 0);
    assert.equal(checked.stdout, '');
    const local = run('prepare', 'false');
    assert.equal(local.status, 1);
    assert.equal(local.stdout, '');
    assert.equal(fs.existsSync(environment), false);
    const prepared = run('prepare', 'true');
    assert.equal(prepared.status, 0);
    const encoded = Buffer.from(config).toString('base64');
    assert.equal(prepared.stdout, `::add-mask::test-token\n::add-mask::test-machine\n::add-mask::${encoded}\n`);
    assert.equal(fs.readFileSync(environment, 'utf8'), `STEAM_CONFIG_VDF=${encoded}\n`);
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
