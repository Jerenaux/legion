#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "$0")/.." && pwd)
manifest="$repo_root/client/.itch.toml"
workflow="$repo_root/.github/workflows/release-desktop.yml"

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
