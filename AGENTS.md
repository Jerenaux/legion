# Repository instructions

## Legion versioning

`client/package.json` is the single source of truth for the Legion product version. Desktop packages and Itch channels must use that exact version. Do not create another version file or independently version each platform.

Every coherent batch that changes shipped code, game assets, dependencies, infrastructure, or release behavior must bump the version once before its final commit. Documentation-only and test-only changes do not require a bump.

Use Semantic Versioning:

- While the game is below `1.0.0`, bump PATCH for compatible fixes and maintenance, and MINOR for features or breaking changes.
- From `1.0.0` onward, bump PATCH for compatible fixes, MINOR for backward-compatible features, and MAJOR for incompatible save-data, API, network-protocol, or platform changes.
- Prerelease identifiers such as `0.2.0-beta.1` are allowed for explicitly staged releases.

Make the bump after syncing the latest `main`, so concurrent branches do not reuse a version. If `main` already contains the intended next version, increment again. Never create a Git tag as part of an ordinary version bump.

Release tags must be `v<version>`, for example `v0.2.0`, and must exactly match `client/package.json`. The desktop workflow rejects mismatched tags and publishes the package version to every Itch channel.
