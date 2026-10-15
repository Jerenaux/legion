# Chinese Emberhall trailer

The Simplified Chinese trailer is a 1,922-frame, 1920×1080, 60 fps variant of
`~/Studio/Emberhall/Emberhall-Trailer-1080p60.mp4`. The gameplay shots are
re-recorded in the current game's real renderer with the `zh-Hans` locale. The
same cut points and staged actions reproduce the October 2026 updated-UI
trailer. The Emberhall end-card illustration and logo animation come from the
original; only its English “COMING SOON” caption changes to “即将推出”. The
soundtrack is copied as the original AAC packets.

Run from the repository root. These tools use a local fixture preview and
headless Playwright; they do not log into Steam, contact matchmaking, or open a
visible browser. The preview fixtures are excluded from production builds.

```sh
node client/tools/guide/preview.cjs

# In another terminal, after the preview finishes compiling:
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
  node client/tools/press/trailer.cjs /absolute/path/to/zh-shots
node client/tools/press/edit-zh.cjs /absolute/path/to/zh-shots \
  "$HOME/Studio/Emberhall/Emberhall-Trailer-1080p60.mp4" \
  "$HOME/Studio/Emberhall/Emberhall-Trailer-zh-Hans-1080p60.mp4"
```

Use `SHOT=opening` or a comma-separated list to re-record selected shots.
`RESUME=1` skips finished MP4s; remove a partial MP4 before resuming. The
editor requires all 17 shot recordings and their `timeline.json`. The capture
script fixes `legion.language` to `zh-Hans` before game startup so Phaser and
the UI use the installed Simplified Chinese catalog and font. The game shots
use local `?press=` fixtures; their character and match state is staged, so
they reproduce actions and framing rather than original live matches. Keep the
fixture code isolated under `client/tools`.

The editor checks every shot length, final frame count, full decode, and AAC
packet hash. It saves `trailer-zh-verification.json` beside the movie. Review
the actual movie manually, especially long Chinese labels, shot cuts, effects,
and the end-card caption; capture scripts are not UI tests. For a later source
trailer, remeasure all frame boundaries before reusing this timeline. Keep
videos and browser profiles out of Git. The only output intended for sharing
is the verified MP4 in `~/Studio/Emberhall/`.

## Chinese store media

The full-game page is https://store.steampowered.com/app/3729580/Emberhall/.
Use headless Playwright for local capture and authenticated store checks whenever
possible. Keep cookies and browser profiles out of the repository and logs.
Steam's Simplified Chinese language code is `schinese`; the game locale is
`zh-Hans`.

With the same preview running, capture the five screenshot compositions and six
description illustrations from the Chinese build:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core \
  node client/tools/press/capture.cjs /absolute/path/to/chinese-store-captures
```

Keep the approved outputs in `~/Studio/Emberhall/Steam/zh-Hans/` alongside the
Chinese trailer in `~/Studio/Emberhall/`.

Review the PNGs against the English store images. The five full screenshots are
`Emberhall-Gameplay-01/02/03-1920x1080`, `Emberhall-Squad-And-Inventory-1920x1080`,
and `Emberhall-Spell-Shop-1920x1080`. In Steamworks **Graphical Assets**, upload
each as a `schinese` localized version on its existing screenshot, preserving
the English image and order.

Make the two eight-second GIFs from the Chinese trailer's combat shots at
0–2, 16–18, 19–21, and 25–27 seconds. Use 15 fps at 616×347 for
`teaser-store-zh-Hans.gif` and 10 fps at 600×338 for
`teaser-mail-zh-Hans.gif`; a 128-color palette keeps each small. Review both
loops after encoding. The latter is a mail asset, not a Steam upload.

For the long description, upload the store GIF and six cropped UI captures as
localized variants of the existing image groups. Name each upload after its
group plus `_schinese` before the extension: `teaser_schinese.gif`, and
`emberhall-ui-{elemental-spell-cards,support-spell-cards,inventory-and-equipment,character-stats,game-modes,leaderboard}_schinese.png`.
In Steamworks **Description → Upload Custom Images**, select all seven, press
**Upload**, and wait for every item to show **Success**; selecting files alone
does not upload them. Existing `{STEAM_APP_IMAGE}/extras/...` references then
choose the correct language automatically. Verify the public `?l=schinese`
page uses different media URLs from `?l=english`.

In **Trailers**, create a new Gameplay trailer using the verified Chinese MP4,
set **Base** to the English gameplay trailer and **Language** to Simplified
Chinese, and leave the English trailer as the base. Save, review the Steamworks
diff, publish the store page, and verify English and Chinese via the public
store page or appdetails API. On Dikaryon's YouTube Studio channel, upload the
same MP4 with a Chinese title and description, select “not made for kids” and
Public, wait for publishing to finish, then verify the video's public URL.
