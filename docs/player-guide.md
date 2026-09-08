# In-game player guide

Players open **Guide** in the top-right menu. The `/guide` page and its screenshots are bundled with the client; reading it does not fetch a remote guide or depend on queue news being enabled.

The queue's **Open guide** card opens the same guide in place, with **Back to queue** controls. Keep `QueuePage` mounted while reading: leaving that component emits `leaveQueue` and removes the match-found listener. Queue updates continue, and a found match opens automatically. The card is independent of the disabled news feature.

Content lives in `client/src/components/GuidePage.tsx`. Keep both the outer route in `client/src/app.tsx` and the inner route in `client/src/routes/HomePage.tsx` when changing this screen.

## Keeping it accurate

Write for players consulting the guide between matches, after the tutorial is over. Do not describe the tutorial game or its onboarding flow. Use clear chapter headings without decorative subtitles or taglines.

The [previous guide](https://guide.play-legion.io/) inspired the chapter structure, not the rules. The implemented game is authoritative:

- Turn rules, movement, targeting, consumable use: `server/src/Game.ts`, `AIGame.ts`, `ServerPlayer.ts`, `TurnSystem.ts`, `Spell.ts`, and `TerrainManager.ts`.
- Item/spell effects, equipment restrictions, SP, unlock milestones: `shared/Items.ts`, `Spells.ts`, `inventory.ts`, `levelling.ts`, and `config.ts`. The guide imports its timer and milestone constants from shared configuration.
- Actual controls and loadout interactions: `client/src/input/actions.ts`, `game/Player.ts`, `components/HUD/PlayerBar.tsx`, and `components/itemDialog/ItemDialog.tsx`.
- Seasonal rankings: `api/functions/src/ranking.ts` and `leaderboardsAPI.ts`.

When changing player-facing rules or controls, update the relevant guide text and screenshots in the same batch. Do not copy old instructions about action-bar hover tooltips, the position of the turn order, or equipping through empty slots. Preserve the distinction between ELO and weekly leagues, and do not advertise disabled features.

## Screenshots and desktop smoke test

From `client`, with dependencies installed:

```sh
bun run guide:screenshots
bun run test:guide
```

The first command renders the real Phaser arena, combat HUD, and Team screen in a hidden Electron window, then captures tight JPEG crops into `client/public/guide/`. It uses a local training fixture, not a live account or an image generator. Check every crop visually after regeneration, especially if the HUD moves. Images are captured at 1600×900 and cropped without changing the UI layout.

The second command builds a production-mode renderer with screenshot-only account/API fixtures. It checks the actual title → Play → burger → Guide flow on `app://legion/`, every chapter jump, image loading, scrolling at 1280×720, 960×540, 800×600, and 1920×1080, Escape/back navigation, and a direct packaged `/guide` load. Renderer errors fail the test. Preview PNGs and the fixture bundle remain in the temporary directory printed by the command; the normal `client/dist` is untouched. Electron needs a graphical session (or Xvfb on Linux).

All HTTP(S)/WebSocket traffic is blocked in this harness. It substitutes only authentication, player data, telemetry API responses, and the battle transport; the app routes, components, assets, and Phaser renderer are real. The release webpack configuration does not import anything in `client/tools/guide`. This is a renderer/navigation smoke test, not a production matchmaking or authentication test.

The smoke test also checks combat recovery: press Z, click outside range, choose a valid target, simulate a server rejection, then verify that movement and Pass Turn remain usable. Server action/resource validation is covered separately by `server/src/__tests__/actionValidation.test.ts`.

It also checks the queue card at desktop and compact window sizes, guide opening/closing and keyboard focus, preserved matchmaking and queue updates while reading, and automatic entry into combat when a match is found with the guide open. It uses the packaged app's shared protocol privileges, including media streaming for the match-found sound; do not replace those with separate test-only settings.

Run the standard lint, TypeScript checks, and tests too. Guide-only changes (copy, presentation, or illustrations) do not require a product version bump. If the same batch also changes gameplay or other shipped behavior, follow the normal versioning rules in `AGENTS.md`.
