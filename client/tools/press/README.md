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
