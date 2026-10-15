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
