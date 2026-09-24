# Daily player and matchmaking statistics

The admin-only `getDashboardData` Firebase endpoint returns UTC daily counts.
`dashboardv2/main.py` displays them, using the selected start date through today.
The default is the last 30 days; requests accept 1–93 days, inclusive.

With the existing admin API key in your environment:

```sh
curl --fail --silent --show-error --get \
  'https://us-central1-legion-32c6d.cloudfunctions.net/getDashboardData' \
  --header "X-API-Key: $API_KEY" \
  --data-urlencode 'startDate=2026-09-01' \
  --data-urlencode 'endDate=2026-09-24'
```

- `newPlayersPerDay`: existing player accounts grouped by `joinDate`. Deleted
  accounts are no longer counted; this is not an immutable signup ledger.
- `DAU`: distinct authenticated accounts that loaded player data that UTC day.
  Repeat visits count once. This is not app launches, downloads, concurrent
  players, or necessarily distinct people. Earlier unawaited writes may have
  missed visits; this fix does not reconstruct missing history.
- `matchesCreatedPerDay`: matchmaking game documents grouped by creation time,
  including unfinished or abandoned games. Creation does not prove combat began.
- `matchesCompletedPerDay`: completed matchmaking games grouped by their end time,
  even when they were created on a different day.

Match counts include casual/ranked, AI opponents, and friend matches, but exclude
tutorial/practice records because those are not one document per combat. They
do not use the synthetic player win/loss totals. Empty days return zero counts;
missing historical DAU documents also return zero, not proof there were no visits.

Each day uses three indexed Firestore count aggregations; only DAU documents in
the date range are downloaded. Cost still depends on matching index entries.
New composite indexes are checked into `firestore.indexes.json`; the API deploy
workflow applies them before Functions. No data migration or desktop release is
needed. Wait for indexes to become ready before querying the deployed endpoint.

The endpoint no longer returns the unused lifetime retention, inactive-player,
median-duration, total-player, or per-mode fields. Its only repository caller is
updated together with it. Other dashboard endpoints retain their existing behavior
and costs; loading the entire dashboard is not equivalent to this lightweight query.

Run regression tests with `cd api/functions && bun run test`.
