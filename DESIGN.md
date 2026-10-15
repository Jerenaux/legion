# Emberhall game interface

Emberhall is played on desktop and handheld screens, with attention moving between
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
- Emberhall is a hall at night lit by its hearth: deep ink-blue shadows, warm firelight
  from below, ember (`--ember`) for menu selection, focus and "ready" states. Combat keeps
  its cyan selection colour. The Play screen is the hall itself: the party gathered at the
  hearth, battle choices beside it, the day's loot below.
- This is a native game window, not a web page: the document never scrolls. Each screen fits
  the window; long lists (shop stock, leaderboards) scroll inside their own pane. No hover-only
  menus, no corner toasts, no full-width underlined section headings; text is not selectable
  except in inputs.
- Keep controls tactile, with a clear pressed state and keyboard focus. Meaning
  must remain available without color or animation. Native control semantics may
  be styled to match the game.
- Short entrance/reveal motion can establish a game moment. It must not gate
  progression and must have a reduced-motion fallback. Use existing sound effects
  sparingly and honor the player's volume settings.
- Validate in the real game, including 1280×720, 800×600, enlarged text, German
  and Japanese. Guidance must leave the action dock and turn order usable.

## Dialog layering

Full-window dialogs use the existing `react-modal` body portal, outside the game
root. `#root` isolates scene/HUD stacking so local z-indexes cannot cover those
dialogs. Do not put a modal overlay inside a navigation bar, animated page or
other isolated/filtered/transformed ancestor; increasing its z-index cannot
escape that ancestor. `SettingsModal` owns its portal and backdrop: render it
directly, without another modal wrapper, from every entry point.

When changing scene or navigation stacking, inspect an open dialog over the live
scene and after closing it, including the dropdown and Escape paths. Check Korean
and an enlarged-text compact layout as well as English; ensure the backdrop covers
the whole window and the dialog controls remain reachable.
Verify dropdown actions with real pointer clicks: transparent scene containers can
intercept clicks even where the menu remains visible. Calling `.click()` on the
element directly bypasses hit testing and will miss this failure.

The game-specific choices here take precedence over generic website or dashboard
styling advice. Accessibility and input behavior remain required.

## Party and localized labels

Keep the hearth and the full party in one responsive grid, including the next
recruit. Reserve space for staggered nameplates so they cannot overlap controls
below. Use `ClassCrest` for class symbols, including the character sheet.
Localized navigation labels must preserve glyph proportions: fit the font size,
never force SVG `textLength` with `spacingAndGlyphs`. Pair shop stat icons with
visible translated labels rather than relying on icon recognition.
