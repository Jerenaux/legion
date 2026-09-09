const assert = require('node:assert/strict');
const {test} = require('node:test');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {validateSteamConfig} = require('./steam-credentials.cjs');

const config = '"InstallConfigStore" { "Software" { "Valve" { "Steam" { "Accounts" { "builder" { "SteamID" "123" } } "ConnectCache" { "hash" "test-token" } } } } "Authentication" { "RememberedMachineID" "test-machine" } }';

test('accepts an isolated credential and identifies values requiring log masking', () => {
  assert.deepEqual(validateSteamConfig(config, 'builder'), ['test-token', 'test-machine']);
  assert.deepEqual(validateSteamConfig(`// Steam config\n${config}\n`, 'builder'), ['test-token', 'test-machine']);
});

test('rejects missing, malformed, oversized, cleared, and other-account credentials without leaking them', () => {
  for (const text of ['', config.slice(0, -1), `${config} }`, `${config} garbage`, `${config} "InstallConfigStore" {}`, config.repeat(300), config.replace('"test-token"', '""'), config.replace('"hash" "test-token"', ''), config.replace('"builder" {', '"other" {} "builder" {')]) {
    assert.throws(() => validateSteamConfig(text, 'builder'), error => {
      assert.doesNotMatch(error.message, /test-token|test-machine/);
      return /Invalid Steam credential/.test(error.message);
    });
  }
  assert.throws(() => validateSteamConfig(config, 'other'), /Invalid Steam credential/);
  assert.throws(() => validateSteamConfig(config, ''), /Invalid Steam credential/);
});

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
