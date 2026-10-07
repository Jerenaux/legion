# Creator communities

A community is a cosmetic affiliation: a sigil and a tag shown next to the player's name in
combat panels, the navbar, profiles, friends and leaderboards. It has no gameplay effect.

## Data

- `communities/{id}`: `{name, tag, sigil, status: 'active' | 'revoked', members, createdAt}`.
  The ID is also the code creators share (`KESTREL` → `kestrel`).
- `players/{uid}.community`: a copy of the summary plus `{joinedAt, via: 'code' | 'link' | 'operator'}`.
  Membership is permanent; only operators change it.
- `communitySeasons/{seasonId}_{communityId}`: `{wins, games}` for one weekly season, incremented by
  `postGameUpdate` for ranked games only. A new season starts new documents, so nothing is reset.
  Revoked communities are hidden from the ranking.

Sigils are four indexes into `shared/communities.ts` (shape, pattern, palette, symbol) and render as
SVG in `client/src/components/sigil/Sigil.tsx`. Never reorder those lists: stored sigils reference them.

## Links

- HTTPS landing page: `https://us-central1-<project>.cloudfunctions.net/communityLink?code=<code>`.
- Steam: `steam://run/3996730/?community=<code>` (read through `GetLaunchQueryParam`).
- Direct downloads: `legion://community/<code>`.

The app asks the player to confirm before joining. Players can also type the code on their profile.

## Operator CLI

From `api/functions` (ADC, or `--gcloud` to use the gcloud access token):

```sh
bun tools/communities.ts create --project legion-32c6d --id kestrel --name "Kestrel Guild" --tag KES [--sigil crest,chevron,0,raven]
bun tools/communities.ts list --project legion-32c6d
bun tools/communities.ts inspect --project legion-32c6d --id kestrel
bun tools/communities.ts set-sigil --project legion-32c6d --id kestrel --sigil heater,quarterly,6,wolf
bun tools/communities.ts assign --project legion-32c6d --id kestrel --player <uid>
bun tools/communities.ts revoke --project legion-32c6d --id kestrel
```

`create` without `--sigil` uses a deterministic sigil derived from the code. `set-sigil` and
`revoke` update every member's stored copy.
