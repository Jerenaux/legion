#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
manifest="$repo_root/client/.itch.toml"
workflow="$repo_root/.github/workflows/release-desktop.yml"

bun - "$workflow" <<'JS'
import assert from "node:assert/strict";
const workflow = Bun.YAML.parse(await Bun.file(process.argv[2]).text());
assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"], "Desktop releases must be manual-only");
assert.equal(workflow.jobs.build.if, "github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'", "Desktop builds must be restricted to main");
const steam = workflow.jobs["upload-steam-private"];
const upload = steam.steps.find(step => step.uses?.startsWith("game-ci/steam-deploy@"));
assert.equal(upload.env?.XDG_DATA_HOME, "/root/.local/share", "SteamCMD must use the image's preinstalled data directory");
assert.equal(upload.env?.STEAM_HOME, `${upload.env?.XDG_DATA_HOME}/Steam/steamcmd`, "Upload credentials must go to the directory SteamCMD actually reads");
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
