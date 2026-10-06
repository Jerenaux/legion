# Backend startup and match preparation

The performance changes preserve the current Iowa deployments and European Firestore database. No minimum-instance settings change. Production timings still include cross-region database latency and Cloud Run cold starts.

## Request paths

- Login reuses persisted Firebase sessions. When a platform exchange is necessary, existing identities use a normal read, user/player checks overlap, and existing players bypass starter-character generation and attempted creation writes. New players, characters and the first practice match are created atomically. Concurrent platform exchanges are idempotent.
- New clients request `bootstrapPlayer`: player and roster share authentication and one player read, while roster loading and activity recording overlap. The initial 400 ms debounce and duplicate in-flight startup requests are removed. `getPlayerData`, `rosterData`, and the client fallback remain for backend-first/client-first rollouts.
- Activity timestamps update at most once per five minutes for serial requests. Store DAU uses a persisted `lastStoreActiveDay` and atomic `arrayUnion` plus a player update in one batch. Simultaneous first arrivals remain correct; ordinary refreshes do no tracking writes. Concurrent requests can still perform duplicate harmless writes.
- The matchmaker reads authoritative queue fields and writes the match plus action records directly to Firestore. It attempts matching immediately after queue insertion. The periodic widening/fallback behavior remains. Discord bot code and its dependencies are removed; community links remain.
- Combat loads match/player data concurrently, reuses the authenticated UID and character references, and fetches human and AI rosters concurrently. Remote Config is shared per process for 60 seconds with concurrent-fetch deduplication; a failed refresh is retried, never cached. Render acknowledgements still gate combat.
- Socket authentication uses Firebase's normally refreshed token. An authentication rejection forces one refresh/retry; a successful connection resets that allowance.

## Zombie opponents

Two queries select up to ten inactive candidates above the requested ELO and ten below it. Ranked requests retain the exact league filter. The queries project only opponent metadata/character references. The ten nearest candidates are considered, and one is chosen randomly. This intentionally favors rating proximity while keeping variation; it replaces the nearest of ten players sampled from the entire inactive population.

The four composite indexes are in `firestore.indexes.json`. The API workflow deploys them and waits for all four to become READY before deploying Functions; missing, failed or timed-out indexes stop deployment. Firestore Emulator checks query behavior but does not prove production index readiness or index scan cost. Once deployed, use Query Explain on both rating directions, with/without league, to verify index entries scanned. A result limit bounds downloaded documents, not every possible index scan; if active players dominate a rating range at much larger scale, a maintained eligible-opponent index may become worthwhile.

Eligibility and league are queried on every request. Only assembled inactive-opponent rosters are cached, for 30 seconds, with a 100-entry bound and a key that includes character references. Human rosters are never cached. Empty eligible pools retain the existing generated-AI fallback.

## Local validation

Requires the pinned Bun version, Node, Java 21+, and dependencies installed in the root, client, server, matchmaker and `api/functions` directories. Set `JAVA_HOME` if Java is not on PATH, then run:

```sh
node tools/backend/run.cjs
```

The runner builds production-mode Functions, starts isolated Auth/Firestore/Functions emulators and both actual Bun services, seeds 1,500 synthetic opponents, benchmarks, and runs real HTTP/Socket.IO checks. It uses loopback endpoints and test API keys, restores any previous local secret override, and stops every process it starts. Occupied test ports cause an early failure. Logs and benchmark JSON are written to the system temporary directory.

The integration checks cover simultaneous account provisioning, bootstrap/legacy equivalence, concurrent store DAU recording, unauthorized API/socket access, first practice, match membership, immediate PvP matching, persisted match/action records, both human readiness acknowledgements, bounded ELO selection, league/inactivity filtering, empty-pool fallback responses and complete AI match loading.

Additional checks: root `bun run lint`; `bunx tsc --noEmit` and `bun test` in client, server, matchmaker and `api/functions`; client `bun run test:guide` for packaged readiness, recovery and telemetry/privacy.

## Measurements (2026-10-06)

Baseline Functions were built from `66b17203` before changes. The same fixture and benchmark requests were used for the optimized build. Each figure is the median of ten requests after one initial request. These are local emulator measurements, not production latency predictions. Small timings vary with emulator/JVM warmup and other machine activity.

| Operation | Baseline | Optimized clean run |
| --- | ---: | ---: |
| Existing platform session | 23 ms | 15 ms |
| Player data | 11 ms | 11 ms |
| Roster | 17 ms | 17 ms |
| Initial player + roster requests | 15 ms | 17 ms (combined bootstrap) |
| Match persistence | 9 ms (legacy HTTP) | 4 ms (matchmaker Socket.IO) |
| Casual zombie selection | 189 ms | 33 ms |
| Ranked zombie selection | 72 ms | 17 ms |

The combined bootstrap removes a separate cold function, one duplicate player read and 400 ms of client debounce; it does not improve the already tiny loopback median. Zombie results across runs were 19–33 ms for casual and 15–18 ms for ranked. The match-persistence comparison includes different transports; the new path also persists action records atomically.

In the clean integration run, practice snapshot delivery took 91 ms, two-player queue-to-match 24 ms, PvP snapshot delivery 29 ms and AI snapshot delivery 63 ms. These are single checks, not percentile claims. Emulator worker startup is roughly one second and is not representative of production container startup. Production measurements and index scan verification remain necessary after deployment.
