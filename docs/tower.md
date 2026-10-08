# The Cinder Tower

An online solo expedition, unlocked after six completed matches beyond the introductory tutorial and entered from Play → The Cinder Tower. The Play card shows progress while locked; the API enforces the same threshold. It uses the existing authoritative combat server and six authored encounters per run. Five branching floors lead to the Cinder Warden. Difficulty tiers 1–5 unlock in order; the first clear also unlocks a Control starting kit. No desktop release or deployment is triggered by this feature itself.

## Rules and content

`shared/tower.ts` defines starting squads, eleven encounters, twelve preparations, recovery and account rewards. Starting stats, inventory and spell loadouts are standardized; the permanent roster never enters combat. Spell lessons replace the oldest of three learned spells when necessary. Upgrades are temporary, including cheaper/weaker Ice and increased Warrior movement.

Ember Approach places two Fire mages beyond a continuous column of flame across all eleven arena rows. Ranged spells can cross it, and Ice extinguishes a section for passage.

Enemies use the same `Team.scaleStats` path as Ranked AI, at 1.5 rather than Ranked’s 1.2 high-difficulty setting. This helper scales every stat once and HP/MP a second time: approximately 2.25× HP/MP and 1.5× attack, defenses, and speed, subject to rounding and existing caps. The existing 15% per-tier HP/attack increase is applied first. Tier 1 Gate Sentries have 180 HP and 13 ATK; the Warden has 540 HP. Authored lineups and player squad stats are unchanged.

Turns are untimed for humans; the combat dock omits the timer and its label. AI retains a bounded fallback if it cannot find a legal action. Frozen characters thaw after two skipped turns in Tower only. The Warden marks a fixed area before its next activation; the warning is part of reconnect snapshots, and clears on death. Its blast deals 35 + 5 × tier damage and leaves fire.

After victory, HP becomes min(maxHP, max(currentHP, ceil(0.3 × maxHP)) + 15); MP restores 15, capped at maxMP. This also revives fallen allies. Statuses clear for the next encounter. Sanctuary restores both resources fully. Quartermaster refills carrying capacity with Potions for the Warrior and Ether for mages. No passive in-combat recovery is added, so delaying victory cannot generate free resources.

## Rewards and persistence

`players/{uid}/tower/current` is the sole current-run document. Authenticated `tower` requests create a run, choose a preparation, start an encounter, or retire between encounters. Mutations require the current run ID and revision; repeated creation resumes an active run. No new Firestore query or composite index is needed: all reads use document IDs.

Starting an encounter atomically creates `games/tower-{uuid}` with its entry snapshot. Reconnecting resumes a live battle; a retired process restarts the encounter from that snapshot. Between encounters, the run can be resumed indefinitely. This is not offline support or a mid-combat save-to-disk feature.

Only the game server can call `towerResult` using the API key. It validates resource bounds and remaining consumables, then atomically settles the game receipt, next run state, account gold/items/XP, and permanent-character XP/levels/SP. The receipt is the game document's `towerSettled` field; duplicate/concurrent deliveries do not pay twice. Failed saves retry on the server and can be retried by reloading. Results become visible only after commit.

Tier 1 standard routes award 555 gold, 900 total XP, Potion, Ether, Ice scroll and Dagger across a complete run. Higher floors award progressively more; elite routes add 25% gold/XP and each tier adds 20%. Final scroll alternates between Ice and Thunder by tier. XP is shared across the current permanent roster. Main-roster inventory, spells and combat stats are never replaced. These are initial balance values to tune against observed run duration and completion rate.

One expedition ending in victory or natural defeat grants one completed-match credit and its milestone unlock rewards, atomically with the final encounter receipt. Individual floors, retirement and giving up grant no credit. Defeat from older servers only qualifies when all squad members have zero HP, preventing their unmarked abandonments from earning credit. ELO, league results, daily keys and practice/adaptive-AI statistics are unchanged. Account rewards already earned remain after defeat or retirement. There is no entry charge, ticket limit, or exclusive competitive equipment.

## Validation and playtesting

- `bun test` in `server`: encounter geometry, upgrade isolation, recovery, untimed turns, freeze recovery, boss warnings, readiness and disconnect behavior.
- Tower store unit tests using an in-memory Firestore imitation have been removed. Check persistence changes through Firestore emulator integration scenarios; the retained combat and UI suites do not validate Tower settlement transactions.
- `bun run test:guide` in `client`: packaged routing, tower entry, choices, keyboard controls, saved state, error recovery, live combat HUD and warning rendering, plus existing regression smoke checks.
- `node tools/guide/capture.cjs --tower-images` in `client`: refresh only the tower guide crop using local fixtures. Fixtures never ship.

Human playtests should check whether players want another run before rewards are emphasized, whether later milestones beat restarting easy floors for reward efficiency, which preparations are consistently skipped, and whether the Warden's warning leaves a useful response for each turn order. No win-rate or completion-time target has been verified with human playtests yet.

First entry explains the temporary squad and persistent HP/MP/supplies inline. The first preparation choice explains upgrades when they become relevant. Match six combines the Tower and spell announcement into one optional invitation.

## Visual presentation

The Play screen uses the same mode-card component for Tower, immediately after Ranked. A warm gold rook and a fine divider distinguish solo expeditions. Inside the mode, the ascent track, squad resource bars, enemy lineups, illustrated preparations and banked spoils make the next decision visible. Keyboard focus, native kit radio inputs and difficulty selection, responsive layouts, and reduced-motion styles are retained.

`client/public/tower_icon.png` was generated with the built-in Imagegen tool, using `practice_icon.png`, `casual_icon.png`, and `ranked_icon.png` as style references. Prompt: Create a fourth Legion game-mode icon, one chess rook on a transparent background. Match the existing bold, chunky silhouette and flat faceted shading, with ivory-gold upper-left highlights, antique-gold midtones, umber right-hand shadows, no outline or noisy texture. Use a crenellated crown, tapered column, broad stepped base and one small ember-lit arched opening. Front view with a slightly visible top. Center the complete piece on a square canvas; no text, ground, separate pedestal, cast shadow, frame or extra objects. It must read at 90 pixels high and resemble game UI artwork rather than realistic architecture or glossy 3D.

The expedition is staged as a game screen: full character sprites and class crests anchor preparation, native kit controls sit above the squad, and the command bar keeps the next action at the bottom. During a climb, enemy lineups, large resource values, and compact squad cards stay visible beside the choices. Detailed rules open from the command bar. Completion has its own result presentation.

`client/public/tower_hall.png` was generated with the built-in Imagegen tool as a quiet background for these screens. Prompt: Use case: stylized-concept. Asset type: 16:9 full-screen background painting for Legion, a fantasy tactical RPG squad preparation screen. Create an empty antechamber inside the Cinder Tower: massive weathered blue-slate stone columns and pointed arches on the extreme left and right, a very distant recessed central archway with a faint warm ember glow, broad worn flagstones across the foreground. Hand-drawn fantasy game environment, crisp ink contours and restrained textured painted shadows, bold readable stone shapes, muted charcoal teal and antique bronze palette. Camera looks straight into the hall, slightly downward, balanced composition with depth. Keep the middle 70 percent calm, dark, low contrast and spacious: separate character sprites and UI will be placed there. Architecture frames the edges and top, small braziers at far left and right cast restrained amber light. Detailed enough to feel like a crafted game world, never realistic or glossy 3D. No characters, furniture, interface panels, lettering, symbols, chess pieces, logos, or text. Wide 16:9 landscape.
