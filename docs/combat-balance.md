# Combat balance

## Combat and progression

`shared/combatBalance.ts` owns damage, support, recovery, level growth and SP
budgets. Server combat, AI damage estimates and client target previews use these
calculations. Round the final damage or healing amount once, with a minimum of
one. Spell statuses are guaranteed; the two poison weapons retain their proc
chances.

- Level multiplier: `1 + min(20, max(0, level - 1)) / 100`.
- Damage: `potency × level multiplier × (50 + attack) / (50 + defense)`.
  Physical attacks use ATK/DEF, spells use SPATK/SPDEF; clamp negative stats to zero.
- Healing and damage-over-time potency:
  `potency × level multiplier × (1 + SPATK / (100 + SPATK))`.
- Recovery: action cooldown times
  `1 - 0.3 × speed / (50 + speed)`; Haste multiplies that result by `0.85`.
- Fixed class baselines replace random starting stats and recruitment jackpots.
  HP gains the level multiplier; other base stats stay fixed. Dynamic AI
  difficulty multipliers and developed zombie-team scaling remain unchanged.
- Level-ups award two SP through level 21 (40 SP), then one per level up to the
  level-50 cap (69 SP). Characters at level 50 stop gaining XP. There is no
  per-stat limit: any stat can take every point (see the build simulation below).
- Mages start with three spell slots and gain one at levels 15, 25 and 40
  (`SPELL_SLOT_UNLOCK_LEVELS`). Learned spells can be removed or replaced outside combat.
  One SP buys 2 HP, 1 MP/ATK/DEF/SPATK/SPDEF; every two allocated SP buy one
  SPEED, rounded down on the total allocation. No fractional stats are stored.
  Resetting SP outside combat refunds every allocated point at no cost.

Elemental spell tiers cover 1, 7 and 19 tiles and require levels 1, 10 and 20.
They retain friendly fire. Fire potency is 26/22/18 for 10/18/28 MP; Thunder
24/20/16 for 14/24/36 MP; Ice 18/15/12 for 16/28/40 MP. Wider areas trade direct
single-target damage for coverage. Fire terrain has base potency 6 and damages a
character at turn start and at most once per movement action. Terrain does not
expire with time.

Thunder skips one affected activation; ice skips three. Silence blocks spells
for two affected activations. Poison has base potency 8 for three activations.
Reapplication refreshes a capped duration rather than adding durations.
Warm tiles never hold ice. A tile is warm while it is inside a Warmth zone or next to a
flame (not the flame tile itself). Ice cast over a warm tile doesn't form there; anyone
standing on it still takes the Ice spell's damage. Clients play the ice forming and melting
on that tile with a "Melted" label (terrain update `iceRemoval: 'blocked'`), and label
every melt caused by fire or Warmth the same way (`iceRemoval: 'warmth'`). A Salamander
Ring wearer outside warm tiles shows Resisted instead. Warmth is judged
before the cast, so ice that puts out a flame still can't form beside it. A new flame melts
any ice next to it, freeing whoever was held. Ice still extinguishes flame tiles as before.
Warmth (White Mage, level 5, 18 MP, 7 tiles, 1,000 gold) melts the ice in its area and keeps
those tiles warm through the caster's next three turns (the casting turn doesn't count). It
fades at once if the caster is knocked out. It affects both sides, so a careless cast can
free a frozen enemy. Clients draw warm tiles with a pulsing glow and rising heat; the server
sends the full set (`warmth` event and game snapshot) whenever it changes. Remedy
removes harmful statuses except ice; Remedy, Antidote and Bocca can target allies.
Revive restores 30% maximum HP for 35 MP, with no per-match use limit. Clover, the
consumable revive, also restores 30% maximum HP. A revive's effect value is that percentage.

## Saved-character migration

`balanceCharacter` normalizes permanent roster characters, preserving identity,
XP, level, spells, equipment IDs and inventory. On the first balance-version
change it stores the old stats, SP bonuses and SP totals in `legacyBalance`,
refunds allocations into the new level-based SP budget, and recomputes fixed
base stats and equipment bonuses. Repeat reads do not refund again. Existing
spent points above the new budget are retained in the legacy record, not added
to the capped current budget. Roster reads persist migration transactionally;
combat also normalizes permanent characters before using them.

SP spending validates positive whole amounts, stat indices, ownership, remaining
points and the per-stat cap. Spend/reset writes use transaction receipts when a
request ID is supplied. Existing clients without a request ID remain accepted.
Temporary Tower squads keep their run-specific stats and upgrades.

## Equipment budgets

Equipment uses modest integer bonuses. The shared catalog is authoritative for
new and existing equipment; item IDs, ownership, slots, classes, rarity and prices
are unchanged. Existing characters must recalculate equipment bonuses from these
IDs during migration instead of retaining saved bonuses.

A budget point buys one ATK, DEF, SPATK, SPDEF or MP; two HP; or half a SPEED
point (SPEED bonuses remain whole numbers and cost two points each). An extra
consumable slot costs eight points, accounting for its extra heal, MP recovery or
remedy opportunity. Both left and right rings consume their full item budget.

Poison weapons retain their existing proc chances. They reserve
`ceil(8 damage × 3 activations × proc chance / 2)` points for poison: ten for
Serpent's Fang and four for Viridian Striker. This values expected nominal poison
damage like HP and charges the effect against the same budget as direct stats.
Repeated applications refresh duration; they do not buy additive poison stacks.
While a DoT is active, reapplying it keeps the stronger tick, so weapon poison never
weakens a caster's scaled poison.
These are balance weights, not a claim that every stat is equally useful in
every matchup. Poison may be cleansed before all ticks; extra consumable slots
still require acquiring items and spending an action.

Common pieces spend 3–7 points, rare pieces 8–12, epic pieces 8–16, and legendary
pieces 16–20. Premium equipment expands options without the former +100 ATK,
+150 MP or +50 DEF jumps. Light boots now provide DEF and SPDEF rather than two DEF entries.

Prices follow the budget: 100 gold per point up to 7 points, 120 for 8–10, 125 for
12 and 150 for 16 or more, rounded to 100 (for example 2,400 for a 16-point
weapon). Belts keep a premium (1,500 and 4,000) because an extra item slot is
multiplied by every consumable it carries. Rarity is set per item in
`shared/Equipments.ts` and no longer follows price, so cheaper premium pieces keep
their colour and chest-drop pool. The shop still unlocks equipment by price
(`EQUIPMENT_BATCH_GOLD`), so repriced items can unlock in an earlier batch.

| ID | Equipment | Bonuses / effect | Budget |
|---:|---|---|---:|
| 0 | Jagged Sword | +12 ATK; +4 DEF | 16 |
| 1 | Basic staff | +2 SPATK; +2 MP | 4 |
| 2 | Ring of the Soul | +20 MP | 20 |
| 3 | Basic belt | +1 item slot | 8 |
| 4 | Large belt | +2 item slots | 16 |
| 5 | Dagger | +3 ATK | 3 |
| 6 | Traveler's hat | +3 DEF | 3 |
| 7 | Cloth tunic | +4 DEF | 4 |
| 8 | Hardened gloves | +5 DEF; +3 SPDEF | 8 |
| 9 | Whispering Boots | +1 SPEED; +2 MP; +1 DEF; +1 SPATK; +1 SPDEF | 7 |
| 10 | Golden necklace | +20 HP | 10 |
| 11 | Helmet | +6 DEF; +2 SPDEF | 8 |
| 12 | Leather armor | +7 DEF; +3 SPDEF | 10 |
| 13 | Armored gloves | +8 DEF; +4 ATK | 12 |
| 14 | Armored boots | +4 DEF; +4 SPDEF; +1 SPEED | 10 |
| 15 | Light gloves | +3 DEF | 3 |
| 16 | Jade necklace | +6 MP | 6 |
| 17 | Golden ring | +8 HP | 4 |
| 18 | Knight's helmet | +9 DEF; +3 SPDEF | 12 |
| 19 | Knight's armor | +9 DEF; +3 SPDEF | 12 |
| 20 | Light boots | +2 DEF; +2 SPDEF; +1 SPEED | 6 |
| 21 | Ruby ring | +4 HP; +2 ATK; +2 DEF | 6 |
| 22 | Teardrop necklace | +12 HP | 6 |
| 23 | Astral Scepter | +4 HP; +4 MP; +1 DEF; +6 SPATK; +3 SPDEF | 16 |
| 24 | Sorcerer's Cowl | +4 HP; +4 MP; +2 DEF; +4 SPATK; +4 SPDEF | 16 |
| 25 | Novice Wizard's Hat | +2 MP; +1 DEF; +2 SPATK; +2 SPDEF | 7 |
| 26 | Acolyte's Tunic | +2 DEF; +2 SPDEF; +1 SPATK; +2 MP | 7 |
| 27 | Traveler's gloves | +4 HP; +2 DEF; +1 ATK; +2 SPDEF | 7 |
| 28 | Sentinel's Greaves | +4 HP; +3 DEF; +1 SPDEF; +1 SPEED | 8 |
| 29 | Ruby signet | +4 HP; +2 MP; +2 ATK; +2 DEF; +2 SPDEF | 10 |
| 30 | Wayfarer's cord | +4 HP; +1 MP | 3 |
| 31 | Sturdy Iron Sword | +5 ATK; +1 DEF | 6 |
| 32 | Serpent's Fang | +2 ATK; +4 MP; 80% poison, 3 activations | 16 |
| 33 | Viridian Striker | +8 ATK; 30% poison, 3 activations | 12 |
| 34 | Salamander Ring | Cannot be frozen; takes 50% more fire damage | 16 |
| 35 | Fur Boots | +2 DEF; +2 SPDEF; freezes last 1 activation less | 8 |

Ice counters are priced like stats. Freeze immunity is worth 20 points, because ice can
skip three activations, minus 4 for the Salamander Ring's fire weakness (+50% from fire
spells, flame tiles and burns). Fur Boots trade the SPEED of Light boots for a
one-activation shorter freeze, valued at 4 points. The Salamander Ring is epic and costs
2,400 gold; Fur Boots are rare and cost 1,000, so they unlock in the second equipment batch.

## Balance review

With the shared `(50 + attack) / (50 + defense)` damage ratio, each attack or
defense point changes damage smoothly. Fully equipped warriors can gain at most
20 ATK (Jagged Sword, Armored Gloves and two Ruby rings/signets); fully equipped
mages can gain at most 12 SPATK (Astral Scepter, Sorcerer’s Cowl, Acolyte’s Tunic
and Whispering Boots). These are deliberate whole-loadout limits under the
current catalog, not extra runtime caps. Existing adaptive-AI multipliers are
unchanged and must be evaluated separately from human PvP loadouts.

Account-roster migration does not apply to temporary Tower squads: their authored
stats and run upgrades remain intact. Recruit listings show normalized stats
before purchase, and the purchase transaction persists those same stats. Freeze
lasts three affected activations in Tower as in other modes; when it expires, the
ice holding the character melts. Ice cast on empty tiles remains an obstacle.

## Simulation findings

Run `bun test server/src/__tests__/combatBalance.test.ts` from the repository root.
The cases send attacks and spells over a real loopback Socket.IO connection into
`Game`, `ServerPlayer`, `Spell`, terrain and initiative handling. Combat time is
advanced explicitly; persistence is stubbed. The separate backend emulator smoke
suite covers migration, SP validation, ownership and concurrent receipt retries.

Warrior melee against an unequipped Black Mage, at equal levels:

| Level | Mage HP | Baseline damage / hits | Offensive SP damage / hits | Defensive SP damage / hits |
|---:|---:|---:|---:|---:|
| 1 | 110 | 31 / 4 | 31 / 4 | 31 / 4 |
| 10 | 120 | 34 / 4 | 43 / 3 | 26 / 5 |
| 21 | 132 | 37 / 4 | 48 / 3 | 28 / 5 |

The offensive case spends 18/20 SP on the attacker's ATK at levels 10/21; the
defensive case spends those points on the target's DEF. Both have zero equipment
bonuses. Baseline time to defeat stays at four hits as levels increase.

At level 21, a mage with maximum SPATK equipment and 20 SP reaches 48 SPATK.
The following are measured **direct damage per target**, excluding terrain,
status damage, healing and retaliation:

| Element | Tiers I / II / III vs 132 HP, 14 SPDEF | Tiers I / II / III vs 208 HP, 52 SPDEF |
|---|---|---|
| Fire | 48 / 40 / 33 | 30 / 25 / 21 |
| Thunder | 44 / 37 / 29 | 28 / 23 / 18 |
| Ice | 33 / 28 / 22 | 21 / 17 / 14 |

The second target equips maximum SPDEF gear and spends 20 SP each on HP and
SPDEF. None of these hits defeats a healthy target in one cast. Defensive builds
remain substantial: Ice X takes 15 direct hits against this target. Area and
control spells should not be evaluated as single-target damage alone. Separate
casts at 49, 50 and 51 SPDEF differ by at most one damage point, with no cliff.

Adaptive-AI duels are a separate sample: a level-1 warrior making melee attacks
faces a level-1 AI mage that chooses Fire, Thunder, movement or melee using the
real planner. Existing multipliers, including their current HP/MP application,
remain unchanged. At scales 0.6, 1 and 1.5 the AI starts with 40/110/248 HP and
22/60/135 MP. The warrior wins the 0.6 case in five total activations; the AI wins
the other cases in twelve and nine. Thunder can disable consecutive activations
when reapplied, even though its duration cannot accumulate. Remedy, positioning
and MP pressure therefore still need attention in team playtests.

These are controlled combat samples, not human playtests or an estimate of live
win rates. Team composition, focused attacks, terrain coverage, healing and item
use can change the results; monitor those after a coordinated client/server rollout.

## Adaptive AI difficulty

Matches against the AI (Practice, and Casual or Ranked when the queue falls back to
an AI or saved-player opponent) adapt to the player's win ratio over their last
20 AI matches (`shared/aiDifficulty.ts`): `(wins − 1) / (matches + 2)`, so a new
player starts at 0. Matches recorded before the window existed count at the
player's earlier average. Practice subtracts 0.1; Ranked-vs-AI adds 0.1 plus 0.1
per league. `AIGame.applyDifficulty` maps the ratio to AI sharpness, available
tools and `DIFFICULTY_STAT_SCALES`. With a full window the ratio peaks at 0.86,
so the elite tier (above 0.9) is reached only through the Ranked-vs-AI bonus.

`bun tools/difficultySim.ts` (from `server`) plays a player-proxy AI team against
generated teams at each tier through the production combat and AI code. It
reports the proxy's score, counting matches still undecided after 1,500
activations as half a win; since #142, many more mid-tier matches stall (up to
half at level 20). After #142 the 0.92/0.93 normal/hard scales made those tiers
up to 19 points harder at level 1 and 2–8 points harder elsewhere. 0.90/0.90
restores the pre-#142 averages (400 matches per cell, ±2.5 points):

| Level | r=0.2 | r=0.45 | r=0.75 | r=0.95 |
|---:|---:|---:|---:|---:|
| 1 | 99 (pre-#142: 99) | 72 (79) | 73 (84) | 5 (6) |
| 5 | 100 (100) | 74 (70) | 74 (74) | 3 (5) |
| 12 | 93 (100) | 72 (73) | 71 (67) | 10 (16) |
| 20 | 93 (94) | 66 (65) | 65 (62) | 18 (16) |

The proxy's own sharpness (0.5 or 0.8) changed scores by only a few points. A
single multiplier cannot reproduce the pre-#142 slope across levels in the hard
tier; it matches the average.

## Coordinated rollout

Deploy backend and desktop clients together. Authoritative combat snapshots now
include effective combat stats and spell effects, which the new client uses for
exact direct HP previews. They also populate the existing `towerSpellCosts`
protocol field for every character: installed clients already read this override
outside Tower, so their casting checks and combat MP display use current server
costs while the desktop update rolls out. Tower-specific overrides remain.

Older clients still contain old shop descriptions, SP controls and consumable
targeting. In particular, they cannot redistribute SP or target an allied
character with a Remedy, and their ice-terrain action gate predates timed thawing.
The updated client is required for the revised ice behavior too; do not describe
these features as available until the client update is installed. The server validates spending and owns all damage,
healing, statuses and costs. New clients omit damage previews for old snapshots
that do not provide authoritative stats rather than guessing from class defaults.

AI threat and spell estimates share the combat formulas. Movement charges only
the first crossed fire tile's actual damage, matching one exposure per move,
and values ending in fire as two future exposures. Those latter weights remain
planner heuristics, not changes to terrain duration or adaptive difficulty.

Equal initiative times use a random tie-breaker, redrawn each time a character is rescheduled, so neither team order nor one lucky draw wins every later tie; authored tutorial openings, recovery times and damage remain unchanged.

AI characters use the same scale as players: class baseline at their level plus
that level's SP budget, spent by class weights under the same 20-per-stat cap. The
legacy random level-up curve remains only for zombie-team scaling. The Tower's
Sculptor of Ice halves Ice's MP cost (rounded up) and its damage.

## Build and level simulation

`cd server && bun tools/build-simulation.ts [matchesPerPairing]` plays headless 3v3
AI-vs-AI matches (warrior, white mage, black mage per side) on the production
combat engine, with the shared SP budget, spell-slot rules and AI spell loadouts.
Only the combat clock (virtual time), persistence and network are stubbed. Both
sides play at full AI skill with starter consumables and no equipment, and swap
sides every match. AI casters stop casting once out of MP, so most matches end at
the 10-minute virtual limit and are decided on remaining HP; knockouts and
decisions are reported separately.

October 2026 run, 400 matches per pairing (about ±5% margin):

- At level 21 (40 SP), balanced, all-in offense, the former 20-point cap, and
  tank builds win 43–61% against each other: no build dominates, so the per-stat
  cap was removed. Putting every point into Speed is a weak build (it loses 69–79%).
- Balanced level 25/30/40/50 teams beat level 21 teams 51–56% / 51–54% / 58–64% /
  62–69%. For comparison, level 21 beats level 15 64–66% and level 15 beats level
  10 65%: the whole post-21 range adds about one early-game level gap.
- With best-in-slot equipment on both sides (belts excluded), offense-heavy builds
  gain an edge: all-in offense beats balanced 63% and tank 59%, but stays even with
  the former capped split (47%). Favoured, not dominant.
- Equipment outweighs levels and SP: fully geared teams beat ungeared ones at the
  same level 94–98%, geared level 10 beats ungeared level 21 85%, and geared level
  21 beats ungeared level 50 89%. Cheaper premium equipment (October 2026 prices)
  shortens the time to that power rather than adding any.

