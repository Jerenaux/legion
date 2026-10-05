# Legion game interface

Legion is played on desktop and handheld screens, with attention moving between
animated combatants, the arena and action controls. Its UI should feel like the
same game before, during and after battle. Read `docs/game-ui-writing.md` for copy.

- Use the existing Kim display font with the configured locale font fallback
  for game headings, character names and action buttons. Explanatory text stays
  compact and readable. Avoid website hero typography and repeated taglines.
- Use the existing gold beveled buttons for the main action, dark ink-blue
  backing where contrast is needed, and the class crest palette: gold warrior,
  green white mage, violet black mage. Do not apply a generic web-app design kit.
- Reuse real character sprites, class crests, item sprites and HUD icons. Keep
  character sprites at game scale or smaller; enlarging them exposes edge artifacts.
  Use nearest-neighbor rendering and the same symbols for the same action everywhere.
- Present a party as characters occupying a shared scene. Present rewards as
  loot. Use framed panels for inspection or a short instruction, not as a default
  wrapper around every object.
- Keep controls tactile, with a clear pressed state and keyboard focus. Meaning
  must remain available without color or animation. Native control semantics may
  be styled to match the game.
- Short entrance/reveal motion can establish a game moment. It must not gate
  progression and must have a reduced-motion fallback. Use existing sound effects
  sparingly and honor the player's volume settings.
- Validate in the real game, including 1280×720, 800×600, enlarged text, German
  and Japanese. Guidance must leave the action dock and turn order usable.

The game-specific choices here take precedence over generic website or dashboard
styling advice. Accessibility and input behavior remain required.
