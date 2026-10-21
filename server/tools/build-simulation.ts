// Headless 3v3 AI-vs-AI matches on the production combat engine, to compare SP builds and level gaps.
// Only the combat clock, persistence and network are stubbed; every action, effect and AI decision is real.
// Usage: bun tools/build-simulation.ts [matchesPerPairing]
import {Server} from 'socket.io';
import {Class, League, PlayMode, Stat, StatFields} from '@legion/shared/enums';
import {baseStats, spBonus, spBudget} from '@legion/shared/combatBalance';
import {spellSlotsAt} from '@legion/shared/inventory';
import {getSpellById, getSpellsUpToLevel} from '@legion/shared/Spells';
import {aiSpellLoadout, setUpInventory} from '@legion/shared/NewCharacter';
import {getConsumableById} from '@legion/shared/Items';
import {BASE_CHARACTER_CARRYING_CAPACITY} from '@legion/shared/config';
import {Item} from '../src/Item';
import {STARTING_WHITE_MAGE_SPELLS} from '@legion/shared/config';
import {Game} from '../src/Game';
import {AIServerPlayer} from '../src/AIServerPlayer';
import {Spell} from '../src/Spell';
import {TurnSystem} from '../src/TurnSystem';

globalThis.fetch = (() => Promise.reject(new Error('Simulation must stay offline'))) as unknown as typeof fetch;
for (const method of ['log', 'info', 'warn', 'debug'] as const) console[method] = () => {};
const print = (...values: unknown[]) => process.stdout.write(`${values.join(' ')}\n`);

const budget = spBudget;

type Build = 'balanced' | 'glass' | 'capped' | 'tank' | 'speed';
const offense = (c: Class) => c === Class.WARRIOR ? Stat.ATK : Stat.SPATK;

/** SP allocations for one character; no per-stat cap, except `capped` (today's 20-point limit). */
function allocate(c: Class, points: number, build: Build): Partial<Record<Stat, number>> {
  const split = (stats: Stat[]) => Object.fromEntries(stats.map((stat, i) =>
    [stat, Math.floor(points / stats.length) + (i < points % stats.length ? 1 : 0)]));
  switch (build) {
    case 'balanced': return split([Stat.HP, offense(c), c === Class.WARRIOR ? Stat.DEF : Stat.SPDEF, Stat.SPEED]);
    case 'glass': return {[offense(c)]: points};
    case 'capped': return {[offense(c)]: Math.min(20, points), [Stat.HP]: Math.max(0, points - 20)};
    case 'tank': return split([Stat.HP, Stat.DEF, Stat.SPDEF]);
    case 'speed': return {[Stat.SPEED]: points};
  }
}

/** CombatClock with virtual time: jobs run in due order as fast as the CPU allows. */
class VirtualClock {
  private jobs = new Map<number, {callback: () => void; due: number}>();
  private nextId = 0;
  private time = 0;
  paused = false;
  now() { return this.time; }
  schedule(callback: () => void, delayMs: number) {
    const id = ++this.nextId;
    this.jobs.set(id, {callback, due: this.time + Math.max(0, delayMs)});
    return id;
  }
  cancel(id: number | null) { if (id !== null) this.jobs.delete(id); }
  pause() {}
  resume() {}
  dispose() { this.jobs.clear(); }
  /** Runs the earliest job; false when nothing is left. */
  step() {
    let next: [number, {callback: () => void; due: number}] | undefined;
    for (const entry of this.jobs) if (!next || entry[1].due < next[1].due || (entry[1].due === next[1].due && entry[0] < next[0])) next = entry;
    if (!next) return false;
    this.jobs.delete(next[0]);
    this.time = next[1].due;
    next[1].callback();
    return true;
  }
}

class SimulatedGame extends Game {
  winner = 0;
  populateTeams() {}
  endGame(winnerTeamID: number) { this.gameOver = true; this.winner = winnerTeamID; }
}

interface Side { level: number; build: Build }

/** 1 or 2 by knockout; 1.5/2.5 when the time limit decides on remaining HP; 0 for an exact tie. */
function match(a: Side, b: Side): number {
  const game = new SimulatedGame(`sim-${Math.random()}`, PlayMode.CASUAL_VS_AI, League.BRONZE, new Server());
  const clock = new VirtualClock();
  (game as unknown as {combatClock: VirtualClock}).combatClock = clock;
  game.saveGameAction = (async () => {}) as never;
  game.saveInventoryToDb = (async () => {}) as never;
  game.config = {};
  const units: AIServerPlayer[] = [];
  for (const [teamId, side] of [[1, a], [2, b]] as const) {
    const team = game.teams.get(teamId)!;
    team.teamData.AIwinRatio = 1; // Both sides play at full skill.
    [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].forEach((c, i) => {
      const position = game.getPosition(i, teamId === 2, c);
      const unit = new AIServerPlayer(i + 1, `${side.build}-${i}`, '1_1', position.x, position.y);
      unit.setTeam(team);
      unit.class = c;
      unit.level = side.level;
      const base = baseStats(c, side.level);
      const points = allocate(c, budget(side.level), side.build);
      for (const [key, field] of Object.entries(StatFields)) unit.setStat(Number(key), base[field] + spBonus(Number(key), points[Number(key)] ?? 0));
      unit.hp = unit.getMaxHP();
      unit.mp = unit.getMaxMP();
      unit.equipment = {weapon: -1, armor: -1, helmet: -1, belt: -1, gloves: -1, boots: -1, left_ring: -1, right_ring: -1, necklace: -1};
      // The same starter consumables (Potions, Ethers) the game gives AI characters of this level.
      unit.inventory = setUpInventory(c, side.level, BASE_CHARACTER_CARRYING_CAPACITY).map(id => new Item(getConsumableById(id)!));
      const required = c === Class.WHITE_MAGE ? STARTING_WHITE_MAGE_SPELLS : [];
      unit.spells = aiSpellLoadout(getSpellsUpToLevel(c, side.level), spellSlotsAt(c, side.level), required)
        .map(id => new Spell(getSpellById(id)!));
      team.addMember(unit);
      game.occupyCell(unit.x, unit.y, unit);
      units.push(unit);
    });
  }
  game.gameStarted = true;
  game.combatStarted = true;
  game.turnSystem = new TurnSystem();
  game.turnSystem.initializeTurnOrder(units);
  // The production turn loop schedules every AI decision, cast, movement and turn timeout.
  game.processTurn();
  // AI casters keep their distance once out of MP, so long matches stall where people would not.
  const limit = 10 * 60 * 1000;
  while (!game.gameOver && clock.now() < limit && clock.step()) game.checkEndGame();
  clearInterval((game as unknown as {checkEndTimer?: ReturnType<typeof setInterval>}).checkEndTimer);
  clock.dispose();
  if (game.gameOver) return game.winner;
  const health = (teamId: number) => game.teams.get(teamId)!.getMembers().reduce((sum, unit) => sum + unit.hp / unit.getMaxHP(), 0);
  const [one, two] = [health(1), health(2)];
  return one === two ? 0 : one > two ? 1.5 : 2.5;
}

/** Wins of `a` against `b`, alternating sides to cancel any first-move or map bias. */
function series(a: Side, b: Side, games: number) {
  let wins = 0, knockouts = 0, decisions = 0, ties = 0;
  for (let i = 0; i < games; i++) {
    const result = i % 2 ? match(b, a) : match(a, b);
    if (result === 0) { ties++; continue; }
    const aTeam = i % 2 ? 2 : 1;
    if (Math.floor(result) === aTeam) wins++;
    if (Number.isInteger(result)) knockouts++; else decisions++;
  }
  return {winRate: wins / (games - ties || 1), knockouts, decisions, ties};
}
const describe = (r: ReturnType<typeof series>) =>
  `${(r.winRate * 100).toFixed(0)}% (${r.knockouts} knockouts, ${r.decisions} on HP at time limit${r.ties ? `, ${r.ties} ties` : ''})`;

const games = Number(process.argv[2] ?? 100);
const started = Date.now();
const builds: Build[] = ['balanced', 'glass', 'capped', 'tank', 'speed'];
print(`# Builds at level 21 (40 SP, ${spellSlotsAt(Class.BLACK_MAGE, 21)} spell slots), ${games} matches per pairing`);
for (let i = 0; i < builds.length; i++) for (let j = i + 1; j < builds.length; j++) {
  const result = series({level: 21, build: builds[i]}, {level: 21, build: builds[j]}, games);
  print(`${builds[i]} vs ${builds[j]}: ${describe(result)}`);
}
print('# Level gaps, balanced builds');
for (const [high, low] of [[25, 21], [30, 21], [40, 21], [50, 21], [50, 40], [21, 15], [15, 10]]) {
  const result = series({level: high, build: 'balanced'}, {level: low, build: 'balanced'}, games);
  print(`level ${high} (${budget(high)} SP) vs level ${low} (${budget(low)} SP): ${describe(result)}`);
}
print(`# ${((Date.now() - started) / 1000).toFixed(0)}s`);
process.exit(0);
