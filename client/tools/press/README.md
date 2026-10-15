# Press captures

These scripts reproduce the October 2026 press-kit screenshots and the 32-second
trailer using the real current game renderer. They reuse the guide preview's
local providers. They never connect to Firestore, matchmaking or live games.
The normal Webpack entry and desktop package do not include them.

Start the preview from the repository root:

```sh
node client/tools/guide/preview.cjs
```

With Playwright Core and Chrome available, run:

```sh
# Set PLAYWRIGHT_MODULE to the installed package path if it is outside this repo.
node client/tools/press/capture.cjs /absolute/output/directory
node client/tools/press/trailer.cjs /absolute/shot/directory
node client/tools/press/edit.cjs /absolute/shot/directory /absolute/original-trailer.mp4 /absolute/output/directory/Emberhall-Trailer-1080p60.mp4
```

Set `PLAYWRIGHT_MODULE` to the installed `playwright-core` directory when it is
outside this checkout. Set `CAPTURE_LOCALE=zh-Hans` for Simplified Chinese; the
capture scripts select that language before the page loads. Both languages use
the same staged combat and frame boundaries.

The press scenes reproduce the fixed missing hexes in `server/src/Game.ts`'s
`generateHoles()` method. If the production arena changes, update the
`fixedHoles` list in `scenes.ts` before capturing, then compare a full arena
screenshot with a live match. The October 2026 capture omitted these holes;
do not reuse those combat frames.

To correct only the arena, record `opening,fire,ice-wall,lightning,heal,melee-kill,terrain,freeze,sword,ice-kill,final-fire`
with `SHOT` and copy the six unaffected UI clips (`team-warrior`, `team-mage`,
`spells`, `equipment`, `items`, `rank`) from the previous shot directory before
running `edit.cjs`. Use the corresponding language's previous trailer as the
original input so its soundtrack and closing card remain unchanged. The edit
checks 1922 frames and identical audio packets. The three `Emberhall-Gameplay`
screenshots are the store screenshots with an arena; the other two are UI-only.
In the long store description, the opening teaser is the only arena media;
the six still images show menus and do not need recapturing for arena changes.

The store teaser uses four two-second passages of the finished trailer, starting
at frames 0, 960, 1140 and 1500. Keep the cuts when changing the arena. Render
the store GIF at 616×347, 15 fps (120 frames), and the mail GIF at 600×338,
10 fps (80 frames). For either language, substitute its finished trailer, size,
frame rate and output path here:

```sh
ffmpeg -y -i TRAILER.mp4 -filter_complex \
  '[0:v]trim=start_frame=0:end_frame=120,setpts=PTS-STARTPTS[v0];[0:v]trim=start_frame=960:end_frame=1080,setpts=PTS-STARTPTS[v1];[0:v]trim=start_frame=1140:end_frame=1260,setpts=PTS-STARTPTS[v2];[0:v]trim=start_frame=1500:end_frame=1620,setpts=PTS-STARTPTS[v3];[v0][v1][v2][v3]concat=n=4:v=1:a=0,fps=15,scale=616:347:flags=lanczos,split[gif][palette_source];[palette_source]palettegen=stats_mode=diff[palette];[gif][palette]paletteuse=dither=bayer:bayer_scale=3[out]' \
  -map '[out]' teaser-store.gif
```

For the mail version, change `fps=15,scale=616:347` to
`fps=10,scale=600:338`. Check the GIF's duration and frame count with FFprobe.
On the full game's Steamworks store editor (`3729580`), replace the existing
English and Simplified Chinese trailers in place; keep the Chinese trailer's
base set to the English trailer. Replace screenshot slots 1–3 in each language,
leaving the two menu screenshots alone. Upload `teaser_english.gif` and
`teaser_schinese.gif` into the existing `teaser` localized image group, then
publish the pending store changes. Verify both language variants on the public
store page. Prefer headless capture, inspection and uploads where possible.

The edit needs FFmpeg/FFprobe. It retains the original audio packets and the
Emberhall closing card from frame 1810 onward. Shot boundaries are measured in
60 fps frames; the complete movie contains 1922 frames. It checks capture frame
counts, audio packet hashes and complete decoding. Review the actual images and
video manually; these tools are captures, not UI tests.

`SHOT=opening` (or a comma-separated list of shot names) records selected shots.
`RESUME=1` skips existing recordings. Only resume a completed recording: remove
any partial MP4 after an interrupted run. The final edit checks its frame count.

Screenshots use `?press=1`, `?press=2` and `?press=3` for different accounts and
squads. Trailer presets use 10–20. `?character=0` selects the warrior on the Team
page; `?roster=3` captures the smaller party. These query switches work only in
the fixture preview. Do not add them to production code.

Combat shots are staged recreations of the source sequence, including fire
multikills, ice walls, lightning, healing, melee attacks and freezing. They are
not recordings of the original matches: names, exact unit placements, damage
values and camera paths can differ. The edit preserves the shot order, frame
boundaries, duration and soundtrack. The preview uses the current game layout,
including changes to the arena shape and the dock.

The first source is the approved local rebrand master at
`~/Code/emberhall-branding/trailer-rebrand/trailer-emberhall.mp4`. The October
outputs, original press-kit inventory and Drive replacement manifest are under
`~/Code/emberhall-branding/press-kit-refresh/`. Do not commit videos, downloads,
browser sessions or authentication material.

Each combat shot uses a separate formation and matchup. Its snapshot declares
the action spells so the normal asset loader prepares their effects before
recording. Every captured frame is checked for visible Phaser missing textures;
missing-animation warnings and browser errors stop the capture. Per-shot audit
files and representative frames are saved beside the recordings.
