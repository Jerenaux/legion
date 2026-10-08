# Creator gifts

Install the Steam demo, then click a personal or community gift link. Steam passes the token
to Legion; after platform authentication and player loading, Legion redeems it
and shows the received items. During a match, replay, queue or lobby, redemption
waits until returning to a menu. No code-entry widget or website login is needed.
The reward reveal uses the game's chest art, rarity-colored loot slots and sound
settings. Hovering or focusing a reward shows its inventory card, including
effects, classes and level requirements; gold explains its use in Shop.

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
bun tools/gifts.ts create --project legion-32c6d --usage single --label "Creator name" --rewards /path/to/rewards.json
bun tools/gifts.ts create --project legion-32c6d --usage unlimited --label "Creator audience" --rewards /path/to/rewards.json
# Optionally add --expires 2027-01-01T00:00:00Z
# Optionally add --community CODE: recipients are also invited to that active community
bun tools/gifts.ts list --project legion-32c6d
bun tools/gifts.ts inspect --project legion-32c6d --id GIFT_ID
bun tools/gifts.ts revoke --project legion-32c6d --id GIFT_ID
```

Creation requires `--usage single` (one claim total) or `--usage unlimited`
(any number of accounts, once per account). Existing tokens without a `usage`
field remain single-use. Tokens are independent: an account can claim rewards
from multiple creators/campaigns. Token type is chosen at creation; create a new
token rather than converting an issued token in place.

Creation prints the token, its usage and three links **once**. Keep single-use
links private; creators can distribute unlimited links to their audiences.
Keep tokens out of internal logs, commits, screenshots and PR descriptions. Use `shareURL`
(`https://www.play-legion.io/invite?gift=TOKEN`) for outreach: the invite page shows the
rewards (and the community's sigil when linked), offers installation and a Steam launch
button, and never consumes the gift on GET. `steamURL` launches directly.

### Gifts that invite to a community

`--community CODE` stores `communityId` on the gift; creation fails unless that community
is active. Redemption (`claimed` or `already_claimed`) returns the community summary. The
client shows it in the gift dialog, then offers the usual join confirmation if the player
has no community yet. Membership is never granted by the gift itself and stays permanent
once confirmed. Revoked communities are omitted from receipts and the page.

### Invite page

`https://www.play-legion.io/invite?gift=TOKEN` or `?community=CODE` is rendered by the
`invite` Function (`api/functions/src/invitePage.ts`) through a Firebase Hosting rewrite,
so it shares the site's origin, CSP (no scripts or inline styles), font and artwork.
`website/invite.css` and the reward sprite sheets ship with the website build. Unknown
links return 404; expired, revoked or claimed gifts show an unavailable state without a
claim button. The former `giftLink` and `communityLink` URLs redirect there. After merging,
Functions deploy automatically; deploy the website (`gh workflow run deploy-website.yml
--ref main`) so the rewrite and assets go live. A forwarded
single-use link can be redeemed by its first recipient; it is not tied to a named creator.
The internal label is operator-only and never sent to the game.

Firestore collection `creatorGifts` stores the token's SHA-256 hash as document
ID, `usage`, rewards, label and creation/expiry/revocation timestamps (UTC
milliseconds). Single-use tokens record `claimedBy` / `claimedAt` on that document.
Unlimited tokens keep those fields null and store each receipt at
`creatorGifts/{giftId}/claims/{uid}`, including the rewards actually granted and
`claimedAt`. Each redemption reads the campaign, the account's receipt and the
player, then writes the player and its receipt atomically. No per-redemption
campaign counter or growing array is written, so separate recipients do not
contend on a shared campaign update. Inspect receipts directly in Firestore when
needed; `inspect` and `list` report campaign metadata. The raw token is not stored. Keep the creation
output securely if the link must be resent; otherwise revoke and reissue.
`list` returns the latest 100 gifts. This uses automatic single-field indexing;
redemption uses exact document reads, so no composite index is needed. Existing
Firestore rules deny all client access; the operator CLI uses privileged IAM.

`redeemGift` accepts authenticated POST requests containing only `{token}`.
One Firestore transaction records ownership and adds the configured rewards.
Single-use claims have one winner; other accounts receive `unavailable`, with
no recipient details. Unlimited links allow every account to claim once, even
with concurrent requests. A repeat request returns `already_claimed` and the
receipt without granting again. Unlimited receipts preserve the original reward
list if campaign rewards are later edited. Revocation/expiry block new claims,
including on partially used unlimited links; they do not remove delivered rewards
or prevent successful claimants from retrieving their receipts. Omit `--expires`
for a link with no expiry. Unknown usage values fail closed. Gifts may exceed shared inventory capacity (as chest
rewards do); equipping still follows normal class, level and slot requirements.
Gifts never advance unlock progression or equip themselves.

## Desktop links and local testing

Steam URL: `steam://run/3996730/?gift=TOKEN`. Only the Demo is targeted.
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
Both use the same server-side redemption. The once-per-account limit uses the
authenticated Legion/Firebase UID; direct and Steam identities are distinct
accounts. It is not a once-per-person or cross-platform-identity limit. Each launch revalidates the platform
account instead of trusting a cached Firebase user from another platform/login.

Pending tokens are stored in the app's private user-data directory until the
receipt is dismissed. Failed claims offer Retry or Later, and retry on the next
launch. Tokens never appear in renderer URLs, analytics or visible UI. Launch
parameters accept only 64 lowercase hex characters, never executable commands.

For a live local test, deploy the gift endpoints after checking the branch:

```sh
DEPLOY=true node api/functions/node_modules/firebase-tools/lib/bin/firebase.js deploy \
  --only functions:redeemGift,functions:invite --project legion-32c6d
```

Follow the normal source-map credentials in `docs/error-reporting.md` when
deploying. Build the local client with the usual API/server/matchmaker URLs;
no reward-specific endpoint override or development authentication bypass exists.
Steam continues to launch its installed store build until a desktop release
containing this feature is explicitly published.

Deploy the updated Functions before issuing unlimited tokens. Existing clients
already understand the same links and claim/receipt responses; a desktop update
is needed only for the revised guide copy. No production tokens are migrated.

## Verification

```sh
node tools/backend/run.cjs # isolated Firestore/Auth/Functions + CLI concurrency checks
cd client && bun test electron/__tests__/gifts.test.js
bun run test:guide --gifts --locale=de
bun run test:guide --gifts --locale=ja
```

The fixture harness checks player readiness, running-app delivery, receipts,
invalid/used links, network retry, queue deferral, and compact layouts with large
text. It never contacts production. Also test the built executable with a fresh
gift, click twice, and verify its Firestore receipt and actual inventory change.
