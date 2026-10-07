# Firestore database

Legion's backend uses the **named database `legion` in `nam5`** (United States
multi-region), next to the `us-central1` Functions and Cloud Run services. Its ID
is `FIRESTORE_DATABASE_ID` in `shared/config.ts`. Every backend accessor goes
through it: `firestore()` in `api/functions/src/APIsetup.ts`, and
`getFirestore(FIRESTORE_DATABASE_ID)` in the game server, matchmaker and tools.
Never call `admin.firestore()` or `getFirestore()` without the ID: that reaches the
retired EU `(default)` database. A deployment test enforces this and checks that
`firebase.json`, the emulator config and the index gate use the same ID.

The game client never accesses Firestore directly, so moving the database needs
no client release. `firebase deploy --only firestore` deploys rules and indexes to
the named database only.

## History and fallback

Until October 2026 all data lived in `(default)` in `eur3` (EU), so every query
from the US compute crossed the Atlantic. The data was exported from `(default)`
to Cloud Storage and imported into `legion`. `(default)` was left untouched as a
read-only fallback and still holds the data as of the migration; the export is
kept in the migration bucket listed in the PR that made this change.

Rollback: set `FIRESTORE_DATABASE_ID` back to `(default)`, restore the
`firebase.json` and emulator `firestore` entries to the default database, and
redeploy the API, server and matchmaker. Writes made to `legion` after the
migration would need to be exported and imported back if they must be kept.

## Backups

`legion` has a daily backup schedule (7-day retention). Point-in-time recovery
can be enabled separately if needed.
