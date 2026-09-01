#!/usr/bin/env bash
set -euo pipefail

manifest=client/.itch.toml
workflow=.github/workflows/release-desktop.yml

for platform in windows osx linux; do
  rg -q "platform = \"$platform\"" "$manifest"
done
test "$(rg -c 'scope = "profile:me"' "$manifest")" -eq 3
for channel in windows mac linux; do
  rg -q "ITCH_TARGET:$channel" "$workflow"
done
rg -q 'WIN_CSC_LINK' "$workflow"
rg -q 'APPLE_API_KEY' "$workflow"
rg -q 'STEAM_CONFIG_VDF' "$workflow"
if rg -n 'STEAM_PASSWORD|\+login' "$workflow" tools/legacy_deployment 2>/dev/null; then
  echo "Plaintext Steam password invocation found" >&2
  exit 1
fi
