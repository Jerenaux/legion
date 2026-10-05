# Creator gifts

Install the Steam demo, then click the personal gift link. Steam passes the token
to Legion; after platform authentication and player loading, Legion redeems it
and shows the received items. During a match, replay, queue or lobby, redemption
waits until returning to a menu. No code-entry widget or website login is needed.

## Manage gifts

Run from `api/functions` after `bun ci`, using a Firestore-authorized Google
application-default credential. Alternatively add `--gcloud` to use the active
`gcloud` account (the short-lived access token stays in memory). Always specify
the project. `FIRESTORE_EMULATOR_HOST` is supported for isolated testing.

Create a JSON file containing a reward array, for example:

```json
[
  {"type": "equipment", "id": 2, "amount": 1},
  {"type": "equipment", "id": 9, "amount": 1},
  {"type": "gold", "id": 0, "amount": 500}
]
```

These equipment IDs are Ring of the Soul and Whispering Boots. Valid types are
`equipment`, `spell`, `consumable`, and `gold`; use existing IDs from `shared`.
Gold uses ID 0. Creation and redemption validate item IDs and quantities.

```sh
bun tools/gifts.ts create --project legion-32c6d --label "Creator name" --rewards /path/to/rewards.json
# Optionally add --expires 2027-01-01T00:00:00Z
bun tools/gifts.ts list --project legion-32c6d
bun tools/gifts.ts inspect --project legion-32c6d --id GIFT_ID
bun tools/gifts.ts revoke --project legion-32c6d --id GIFT_ID
```

Creation prints the secret token and three links **once**. Deliver privately;
do not put them in commits, logs, screenshots or PR descriptions. Use `emailURL`
for outreach: its HTTPS page offers installation and a Steam launch button,
without consuming the gift on GET. `steamURL` launches directly. A forwarded
link can be redeemed by its first recipient; it is not tied to a named creator.
The internal label is operator-only and never sent to the game.

Firestore collection `creatorGifts` stores the token's SHA-256 hash as document
ID, rewards, label, creation/expiry/revocation timestamps (UTC milliseconds),
and `claimedBy` / `claimedAt`. The raw token is not stored. Keep the creation
output securely if the link must be resent; otherwise revoke and reissue.
`list` returns the latest 100 gifts. This uses automatic single-field indexing;
redemption uses exact document reads, so no composite index is needed. Existing
Firestore rules deny all client access; the operator CLI uses privileged IAM.

`redeemGift` accepts authenticated POST requests containing only `{token}`.
One Firestore transaction records ownership and adds the configured rewards.
Concurrent claims have one winner. A retry by the winner returns the receipt;
others receive `unavailable`, with no recipient details. Revocation/expiry do
not undo a completed claim. Gifts may exceed shared inventory capacity (as chest
rewards do); equipping still follows normal class, level and slot requirements.
Gifts never advance unlock progression or equip themselves.

## Desktop links and local testing

Steam URL: `steam://run/3996730//?gift=TOKEN`. Only the Demo is targeted.
Legion reads Steam's `GetLaunchQueryParam("gift")` at startup and once per second
while running. This is an in-process SDK read, not network polling. Koffi bridges
this API because steamworks.js 0.4 does not expose it. It loads the exact same
Steam library and initialized client as authentication; it never initializes a
second client. Koffi 2 includes both macOS architectures for universal packages.

The packaged application also handles `legion://gift/TOKEN`, including while
already running. This lets a local build exercise the same redemption path
without uploading it to Steam. On macOS, target the desired build explicitly:

```sh
open -a "$PWD/client/release/mac-arm64/Legion.app" 'legion://gift/TOKEN'
```

On Windows/Linux, launch the local executable with `--legion-gift=TOKEN`; a
second invocation forwards it to the running instance. A direct local build
uses its device account; a Steam-launched build uses its verified Steam account.
Both use the same server-side redemption. Each launch revalidates the platform
account instead of trusting a cached Firebase user from another platform/login.

Pending tokens are stored in the app's private user-data directory until the
receipt is dismissed. Failed claims offer Retry or Later, and retry on the next
launch. Tokens never appear in renderer URLs, analytics or visible UI. Launch
parameters accept only 64 lowercase hex characters, never executable commands.

For a live local test, deploy just the two new endpoints after checking the branch:

```sh
DEPLOY=true node api/functions/node_modules/firebase-tools/lib/bin/firebase.js deploy \
  --only functions:redeemGift,functions:giftLink --project legion-32c6d
```

Follow the normal source-map credentials in `docs/error-reporting.md` when
deploying. Build the local client with the usual API/server/matchmaker URLs;
no reward-specific endpoint override or development authentication bypass exists.
Steam continues to launch its installed store build until a desktop release
containing this feature is explicitly published.

## Verification

```sh
cd api/functions && bun test src/__tests__/gifts.test.ts
cd ../../client && bun test electron/__tests__/gifts.test.js
bun run test:guide --gifts --locale=de
bun run test:guide --gifts --locale=ja
```

The fixture harness checks player readiness, running-app delivery, receipts,
invalid/used links, network retry, queue deferral, and compact layouts with large
text. It never contacts production. Also test the built executable with a fresh
gift, click twice, and verify its Firestore receipt and actual inventory change.
