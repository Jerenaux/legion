#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
manifest="$repo_root/client/.itch.toml"
workflow="$repo_root/.github/workflows/release-desktop.yml"

node --test "$repo_root/tools/steam-credentials.test.cjs"

bun - "$workflow" <<'JS'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const workflow = Bun.YAML.parse(await Bun.file(process.argv[2]).text());
assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"], "Desktop releases must be manual-only");
assert.equal(workflow.jobs.build.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'", "Desktop builds must be restricted to main");
const steam = workflow.jobs["upload-steam-private"];
assert.ok(steam.if.includes("github.ref == 'refs/heads/main'"), "Steam credentials must only be used from main");
assert.deepEqual(steam.concurrency, {group: "steam-demo-upload", "cancel-in-progress": false}, "Steam token updates must be serialized without cancelling an active upload");
const upload = steam.steps.find(step => step.uses?.startsWith("game-ci/steam-deploy@"));
assert.equal(upload.with.configVdf, '${{ env.STEAM_CONFIG_VDF }}', "Use the latest preserved credential, not a stale GitHub secret snapshot");
const restore = steam.steps.find(step => step.name === "Restore Steam credentials");
const preserve = steam.steps.find(step => step.name === "Preserve updated Steam credentials");
assert.match(restore.run, /secrets versions access latest/);
assert.match(restore.run, /steam-credentials\.cjs prepare/);
assert.match(preserve.run, /_github_home\/Steam\/config\/config\.vdf/);
assert.match(preserve.run, /steam-credentials\.cjs validate/);
assert.match(preserve.run, /secrets versions add STEAM_CONFIG_VDF/);
assert.equal(preserve.if, "always() && steps.steam-upload.outcome != 'skipped'", "Preserve refreshed credentials even when a later build/upload operation fails");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "legion-steam-preserve-test-"));
try {
  const bin = path.join(directory, "bin");
  const updated = path.join(directory, "_github_home/Steam/config/config.vdf");
  const calls = path.join(directory, "calls");
  fs.mkdirSync(bin);
  fs.mkdirSync(path.dirname(updated), {recursive: true});
  fs.writeFileSync(path.join(bin, "gcloud"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$STEAM_TEST_CALLS"\n', {mode: 0o700});
  const config = '"InstallConfigStore" { "Software" { "Valve" { "Steam" { "Accounts" { "builder" {} } "ConnectCache" { "hash" "test-token" } } } } }';
  fs.writeFileSync(path.join(directory, "steam-config.vdf"), config);
  for (const [text, outcome, writes, succeeds] of [
    [config, "success", false, true],
    [config.replace("test-token", "rotated-token"), "success", true, true],
    [config.replace("test-token", "rotated-token"), "failure", true, true],
    [config.replace("test-token", ""), "failure", false, true],
    [config.replace("test-token", ""), "success", false, false],
  ]) {
    fs.writeFileSync(updated, text);
    fs.rmSync(calls, {force: true});
    const result = Bun.spawnSync(["bash", "-eo", "pipefail", "-c", preserve.run], {
      cwd: path.resolve(path.dirname(process.argv[2]), "../.."),
      env: {...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: directory, STEAM_USERNAME: "builder", UPLOAD_OUTCOME: outcome, STEAM_TEST_CALLS: calls},
    });
    assert.equal(result.exitCode === 0, succeeds, "Unexpected credential-preservation outcome");
    assert.equal(fs.existsSync(calls), writes, "Only changed, valid Steam credentials may be persisted");
  }
} finally {
  fs.rmSync(directory, {recursive: true, force: true});
}
assert.equal(upload.env?.XDG_DATA_HOME, "/root/.local/share", "The launcher must reuse the image's preinstalled SteamCMD executable");
assert.equal(upload.env?.STEAM_HOME, undefined, "Leave STEAM_HOME unset: the action must write credentials to $HOME/Steam, not the executable directory");
assert.equal(upload.with.appId, 3996730, "Only Legion Demo may receive Steam uploads");
assert.equal(upload.with.firstDepotIdOverride, 3996731, "The first Demo depot is macOS");
assert.equal(upload.with.depot1Path, "mac");
assert.equal(upload.with.depot2Path, "windows");
assert.equal(upload.with.depot3Path, undefined, "Legion Demo has no Linux depot");
const validateBranch = steam.steps.find(step => step.name === "Validate private Steam branch");
assert.ok(validateBranch, "Steam uploads must validate their private destination branch");
for (const branch of ["playtest", "demo-qa", "", "public", "default", "PUBLIC", 'bad"branch', "two words"]) {
  const result = Bun.spawnSync(["bash", "-c", validateBranch.run], {env: {...process.env, STEAM_BRANCH: branch}});
  assert.equal(result.exitCode === 0, ["playtest", "demo-qa"].includes(branch), `Unexpected Steam branch policy for ${branch}`);
}
JS

grep -Eq 'path = "Legion\{\{EXT\}\}"' "$manifest"
test "$(grep -Fc 'scope = "profile:me"' "$manifest")" -eq 1
for channel in windows mac linux; do
  grep -Fq "ITCH_TARGET:$channel" "$workflow"
done
grep -Fq 'WIN_CSC_LINK' "$workflow"
grep -Fq 'APPLE_API_KEY' "$workflow"
grep -Fq 'STEAM_CONFIG_VDF' "$workflow"
if grep -En 'STEAM_PASSWORD|\+login' "$workflow"; then
  echo "Plaintext Steam password invocation found" >&2
  exit 1
fi
