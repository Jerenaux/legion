# The Cinder Tower

An online solo expedition, entered from Play → The Cinder Tower. It uses the existing authoritative combat server and six authored encounters per run. Five branching floors lead to the Cinder Warden. Difficulty tiers 1–5 unlock in order; the first clear also unlocks a Control starting kit. No desktop release or deployment is triggered by this feature itself.

## Rules and content

`shared/tower.ts` defines starting squads, eleven encounters, twelve preparations, recovery and account rewards. Starting stats, inventory and spell loadouts are standardized; the permanent roster never enters combat. Spell lessons replace the oldest of three learned spells when necessary. Upgrades are temporary, including cheaper/weaker Ice and increased Warrior movement.

Turns are untimed for humans. AI retains a bounded fallback if it cannot find a legal action. Frozen characters thaw after two skipped turns in Tower only. The Warden marks a fixed area before its next activation; the warning is part of reconnect snapshots, and clears on death. Its blast deals 35 + 5 × tier damage and leaves fire.

After victory, HP becomes min(maxHP, max(currentHP, ceil(0.3 × maxHP)) + 15); MP restores 15, capped at maxMP. This also revives fallen allies. Statuses clear for the next encounter. Sanctuary restores both resources fully. Quartermaster refills carrying capacity with Potions for the Warrior and Ether for mages. No passive in-combat recovery is added, so delaying victory cannot generate free resources.

## Rewards and persistence

`players/{uid}/tower/current` is the sole current-run document. Authenticated `tower` requests create a run, choose a preparation, start an encounter, or retire between encounters. Mutations require the current run ID and revision; repeated creation resumes an active run. No new Firestore query or composite index is needed: all reads use document IDs.

Starting an encounter atomically creates `games/tower-{uuid}` with its entry snapshot. Reconnecting resumes a live battle; a retired process restarts the encounter from that snapshot. Between encounters, the run can be resumed indefinitely. This is not offline support or a mid-combat save-to-disk feature.

Only the game server can call `towerResult` using the API key. It validates resource bounds and remaining consumables, then atomically settles the game receipt, next run state, account gold/items/XP, and permanent-character XP/levels/SP. The receipt is the game document's `towerSettled` field; duplicate/concurrent deliveries do not pay twice. Failed saves retry on the server and can be retried by reloading. Results become visible only after commit.

Tier 1 standard routes award 555 gold, 900 total XP, Potion, Ether, Ice scroll and Dagger across a complete run. Higher floors award progressively more; elite routes add 25% gold/XP and each tier adds 20%. Final scroll alternates between Ice and Thunder by tier. XP is shared across the current permanent roster. Main-roster inventory, spells and combat stats are never replaced. These are initial balance values to tune against observed run duration and completion rate.

Floors do not grant match-count unlocks, ELO, league results, daily keys, or practice/adaptive-AI statistics. Account rewards already earned remain after defeat or retirement. There is no entry charge, ticket limit, or exclusive competitive equipment.

## Validation and playtesting

- `bun test` in `server`: encounter geometry, upgrade isolation, recovery, untimed turns, freeze recovery, boss warnings, readiness and disconnect behavior.
- `bun test` in `api/functions`: complete-run transactions, concurrent/retried settlement, invalid-resource rollback, stale/locked choices, and permanent-roster isolation.
- `bun run test:guide` in `client`: packaged routing, tower entry, choices, keyboard controls, saved state, error recovery, live combat HUD and warning rendering, plus existing regression smoke checks.
- `node tools/guide/capture.cjs --tower-images` in `client`: refresh only the tower guide crop using local fixtures. Fixtures never ship.

Human playtests should check whether players want another run before rewards are emphasized, whether later milestones beat restarting easy floors for reward efficiency, which preparations are consistently skipped, and whether the Warden's warning leaves a useful response for each turn order. No win-rate or completion-time target has been verified with human playtests yet.
