import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test';
import {createServer} from 'node:http';
import {Server, type Socket} from 'socket.io';
import {io, type Socket as ClientSocket} from 'socket.io-client';
import {Class, EquipmentSlot, equipmentSlotFields, League, PlayMode, Stat, StatFields, StatusEffect, Terrain} from '@legion/shared/enums';
import type {GameData, OutcomeData, TerrainUpdate} from '@legion/shared/interfaces';
import {getTilesInHexRadius} from '@legion/shared/utils';
import {getXPThreshold} from '@legion/shared/levelling';
import {RANKED_XP_COEF, XP_PER_LEVEL} from '@legion/shared/config';
import {baseStats, damageAmount, effectAmount, MELEE_POTENCY} from '@legion/shared/combatBalance';
import {getSpellById} from '@legion/shared/Spells';
import {getConsumableById} from '@legion/shared/Items';
import {equipments} from '@legion/shared/Equipments';
import {applyEquipmentBonuses} from '@legion/shared/inventory';
import {Game} from '../Game';
import {ServerPlayer} from '../ServerPlayer';
import {Spell} from '../Spell';
import {Item} from '../Item';
import {TurnSystem} from '../TurnSystem';

class CombatGame extends Game {
  populateTeams() {}
}
let game: CombatGame;
let transport: Server;
let client: ClientSocket;
let player: ServerPlayer;
let opponent: ServerPlayer;
let ally: ServerPlayer;
let scheduled: (() => void)[];

function stats(unit: ServerPlayer, characterClass: Class, level = 1) {
  unit.class = characterClass;
  unit.level = level;
  const values = baseStats(characterClass, level);
  for (const [key, field] of Object.entries(StatFields)) unit.setStat(Number(key), values[field]);
  unit.hp = unit.getMaxHP();
  unit.mp = unit.getMaxMP();
  unit.equipment = {};
}

beforeEach(async () => {
  const server = createServer();
  transport = new Server(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  game = new CombatGame('balance-socket', PlayMode.RANKED, League.BRONZE, transport);
  player = new ServerPlayer(1, 'Caster', '1_5', 1, 5);
  opponent = new ServerPlayer(1, 'Opponent', '2_5', 2, 5);
  ally = new ServerPlayer(2, 'Ally', '1_6', 1, 6);
  for (const [unit, team, characterClass] of [[player, 1, Class.BLACK_MAGE], [opponent, 2, Class.WARRIOR], [ally, 1, Class.WHITE_MAGE]] as const) {
    stats(unit, characterClass);
    game.teams.get(team).addMember(unit);
    game.teams.get(team).teamData.completedGames = 1;
    game.occupyCell(unit.x, unit.y, unit);
  }
  game.gameStarted = true;
  game.config = {};
  game.turnee = player;
  game.turnSystem = new TurnSystem();
  game.turnSystem.initializeTurnOrder([player, opponent, ally]);
  scheduled = [];
  // Control only the combat timer and external persistence; all actions/effects use production logic.
  spyOn(game.combatClock, 'schedule').mockImplementation(callback => {scheduled.push(callback); return scheduled.length;});
  spyOn(game, 'saveGameAction').mockResolvedValue(undefined);
  spyOn(game, 'saveInventoryToDb').mockResolvedValue(undefined);
  spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External access is forbidden in combat integration'));
  transport.on('connection', (socket: Socket) => {
    socket.join(game.id);
    game.socketMap.set(socket, player.team);
    player.team.setSocket(socket);
    socket.on('action', (action, data, acknowledge) => {
      game.processAction(action, data, socket);
      acknowledge();
    });
  });
  const address = server.address() as {port: number};
  client = io(`http://127.0.0.1:${address.port}`, {transports: ['websocket'], reconnection: false, auth: {combatReady: 1}});
  await new Promise<void>((resolve, reject) => {client.once('connect', resolve); client.once('connect_error', reject);});
});

afterEach(async () => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {
    client?.disconnect();
    game?.combatClock.dispose();
    await new Promise<void>(resolve => transport?.close(() => resolve()));
    mock.restore();
  }
});

async function action(name: string, data: unknown) {
  scheduled.length = 0;
  await client.timeout(2000).emitWithAck('action', name, data);
}
function nextTerrainClear() {
  return new Promise<TerrainUpdate[]>(resolve => {
    const receive = (updates: TerrainUpdate[]) => {
      if (!updates.some(update => update.terrain === Terrain.NONE)) return;
      client.off('terrain', receive);
      resolve(updates);
    };
    client.on('terrain', receive);
  });
}
async function cast(id: number, target = opponent) {
  game.turnee = player;
  player.hasActed = false;
  player.spells = [new Spell(getSpellById(id))];
  await action('spell', {index: 0, x: target.x, y: target.y, target: target.num, targetTeam: target.team.id});
  expect(player.hasActed).toBe(true);
  expect(scheduled).toHaveLength(1);
  scheduled.shift()!();
}

test('Socket.IO attacks and spells agree with shared damage and have no defense cliff or random damage', async () => {
  player.setMP(1000);
  const damage: number[] = [];
  for (const defense of [0, 49, 50, 51, 100]) {
    opponent.setHP(1000);
    opponent.stats[Stat.DEF] = defense;
    opponent.stats[Stat.SPDEF] = defense;
    for (const roll of [0, .99]) {
      const random = spyOn(Math, 'random').mockReturnValue(roll);
      player.hasActed = false;
      const beforeAttack = opponent.hp;
      await action('attack', {target: 1, sameTeam: false});
      expect(beforeAttack - opponent.hp).toBe(damageAmount(MELEE_POTENCY, player.level, player.getStat(Stat.ATK), defense));
      const beforeSpell = opponent.hp;
      await cast(0);
      const dealt = beforeSpell - opponent.hp;
      expect(dealt).toBe(effectAmount(player.spells[0].effects[0], player, opponent));
      expect(dealt).toBeGreaterThan(0);
      if (roll === 0) damage.push(dealt);
      random.mockRestore();
    }
  }
  expect(Math.max(...damage.slice(1, 4)) - Math.min(...damage.slice(1, 4))).toBeLessThanOrEqual(1);
});

test('equal-speed opening ties can favor either team, while authored tutorial order stays fixed', async () => {
  player.stats[Stat.SPEED] = 20;
  opponent.stats[Stat.SPEED] = 20;
  ally.stats[Stat.SPEED] = 10;
  for (const winner of [1, 2]) {
    const random = spyOn(Math, 'random')
      .mockReturnValueOnce(winner === 1 ? .1 : .9)
      .mockReturnValueOnce(winner === 2 ? .1 : .9)
      .mockReturnValueOnce(.5);
    game.turnSystem.initializeTurnOrder([player, opponent, ally]);
    random.mockRestore();
    game.turnee = game.turnSystem.getNextActor();
    const snapshot = new Promise<GameData>(resolve => client.once('gameStatus', resolve));
    game.sendGameStatus(player.team.getSocket());
    const packet = await snapshot;
    expect(game.turnee.team.id).toBe(winner);
    expect(packet.queue[0]).toMatchObject({team: winner, num: 1});
  }
  const opening = [ally, player, opponent];
  const random = spyOn(Math, 'random').mockReturnValueOnce(.5).mockReturnValueOnce(.1).mockReturnValueOnce(.9);
  game.turnSystem.initializeTurnOrder([player, opponent, ally], opening);
  random.mockRestore();
  game.turnee = game.turnSystem.getNextActor();
  const snapshot = new Promise<GameData>(resolve => client.once('gameStatus', resolve));
  game.sendGameStatus(player.team.getSocket());
  expect((await snapshot).queue.map(unit => [unit.team, unit.num])).toEqual([[1, 2], [1, 1], [2, 1]]);
  expect(game.turnee).toBe(ally);
});

test('Socket.IO snapshots advertise authoritative spell costs and effective stats before casting', async () => {
  player.spells = [new Spell(getSpellById(3))];
  player.setMP(1000);
  opponent.setHP(1000);
  for (const cost of [player.spells[0].cost, 7]) {
    // The second cast represents an authored per-match cost override such as Tower.
    player.spells[0].cost = cost;
    const snapshot = new Promise<GameData>(resolve => client.once('gameStatus', resolve));
    game.sendGameStatus(player.team.getSocket());
    const packet = await snapshot;
    const unit = packet.player.team[0];
    expect(unit.towerSpellCosts[3]).toBe(cost);
    expect(unit.combatStats[Stat.SPATK]).toBe(player.getStat(Stat.SPATK));
    expect(unit.spellEffects[3]).toEqual(player.spells[0].effects);
    expect(packet.opponent.team[0].combatStats[Stat.SPDEF]).toBe(opponent.getStat(Stat.SPDEF));
    const before = player.mp;
    player.hasActed = false;
    await action('spell', {index: 0, x: opponent.x, y: opponent.y, target: opponent.num, targetTeam: opponent.team.id});
    expect(player.hasActed).toBe(true);
    expect(before - player.mp).toBe(unit.towerSpellCosts[3]);
    scheduled.shift()!();
  }
});

test('Thunder skips exactly one activation; Ice skips three, then melts so the character can act', async () => {
  player.setMP(1000);
  opponent.statuses[StatusEffect.PARALYZE] = 100;
  await cast(3);
  expect(opponent.statuses[StatusEffect.PARALYZE]).toBe(1);
  opponent.hasActed = false;
  opponent.startTurn();
  expect(opponent.hasActed).toBe(true);
  opponent.endTurn();
  expect(opponent.isParalyzed()).toBe(false);
  await cast(6);
  const thaw = nextTerrainClear();
  for (const remaining of [3, 2, 1]) {
    expect(opponent.statuses[StatusEffect.FREEZE]).toBe(remaining);
    opponent.hasActed = false;
    opponent.startTurn();
    expect(opponent.hasActed).toBe(true);
    opponent.endTurn();
  }
  expect(opponent.canAct()).toBe(true);
  expect(game.terrainManager.getTerrain(opponent.x, opponent.y)).toBe(Terrain.NONE);
  expect(await thaw).toEqual([{x: opponent.x, y: opponent.y, terrain: Terrain.NONE}]);
});

test.each(['obstacle', 'character'])('Socket.IO melee breaks %s ice, clears freeze, and distinguishes it from melting', async kind => {
  const tile = kind === 'character' ? opponent : getTilesInHexRadius(player.x, player.y, 1)
    .find(tile => player.isNextTo(tile.x, tile.y) && !game.getPlayerAt(tile.x, tile.y))!;
  game.terrainManager.updateTerrainFromSpell(new Spell(getSpellById(6)), tile.x, tile.y);
  expect(game.hasObstacle(tile.x, tile.y)).toBe(true);
  const cleared = nextTerrainClear();
  await action(kind === 'character' ? 'attack' : 'obstacleattack', kind === 'character'
    ? {target: opponent.num, sameTeam: false} : {x: tile.x, y: tile.y});
  expect(await cleared).toEqual([{x: tile.x, y: tile.y, terrain: Terrain.NONE, iceRemoval: 'shatter'}]);
  expect(game.hasObstacle(tile.x, tile.y)).toBe(false);
  expect(opponent.isFrozen()).toBe(false);
  expect(player.hasActed).toBe(true);
});

test('Socket.IO fire melts ice without marking a melee break', async () => {
  player.setMP(1000);
  await cast(6);
  const thaw = nextTerrainClear();
  await cast(0);
  expect(await thaw).toEqual([{x: opponent.x, y: opponent.y, terrain: Terrain.NONE}]);
  expect(game.hasObstacle(opponent.x, opponent.y)).toBe(false);
  expect(opponent.isFrozen()).toBe(false);
});

test('Silence blocks two affected activations, refreshes within its cap, and permits a later spell', async () => {
  player.setMP(1000);
  ally.statuses[StatusEffect.MUTE] = 100;
  await cast(11, ally);
  await cast(11, ally);
  expect(ally.statuses[StatusEffect.MUTE]).toBe(2);
  ally.spells = [new Spell(getSpellById(9))];
  for (const remaining of [2, 1]) {
    game.turnee = ally;
    ally.hasActed = false;
    ally.startTurn();
    await action('spell', {index: 0, target: player.num, targetTeam: 1});
    expect(ally.hasActed).toBe(false);
    expect(ally.statuses[StatusEffect.MUTE]).toBe(remaining);
    await action('passTurn', null);
    expect(ally.hasActed).toBe(true);
    ally.endTurn();
  }
  game.turnee = ally;
  ally.hasActed = false;
  await action('spell', {index: 0, target: player.num, targetTeam: 1});
  expect(ally.hasActed).toBe(true);
});

test('Remedy cures an ally’s harmful statuses except Ice, retaining Haste and rejecting Ice-only use', async () => {
  for (const status of [StatusEffect.PARALYZE, StatusEffect.MUTE, StatusEffect.POISON, StatusEffect.BURN, StatusEffect.SLEEP, StatusEffect.FREEZE, StatusEffect.HASTE]) ally.addStatusEffect(status, 3);
  player.inventory = [new Item(getConsumableById(11)), new Item(getConsumableById(11))];
  await action('useitem', {index: 0, target: ally.num, targetTeam: 1});
  expect(player.hasActed).toBe(true);
  for (const status of [StatusEffect.PARALYZE, StatusEffect.MUTE, StatusEffect.POISON, StatusEffect.BURN, StatusEffect.SLEEP]) expect(ally.statuses[status]).toBe(0);
  expect(ally.statuses[StatusEffect.FREEZE]).toBe(3);
  expect(ally.statuses[StatusEffect.HASTE]).toBe(3);
  player.hasActed = false;
  await action('useitem', {index: 0, target: ally.num, targetTeam: 1});
  expect(player.hasActed).toBe(false);
  expect(player.inventory).toHaveLength(1);
});

test('Fire damages once along a multi-tile move and again on a later activation, retaining terrain', async () => {
  game.updatePlayerPosition(opponent, 8, 5);
  const fire = new Spell(getSpellById(1));
  game.terrainManager.updateTerrainFromSpell(fire, 3, 5, opponent);
  const before = player.hp;
  const tick = game.terrainManager.fireDamage.get('3,5');
  await action('move', {tile: {x: 3, y: 5}});
  expect(player.hasActed).toBe(true);
  expect(scheduled).toHaveLength(2); // One terrain hit and the next-turn callback.
  scheduled.shift()!();
  expect(before - player.hp).toBe(tick);
  player.startTurn();
  expect(before - player.hp).toBe(tick * 2);
  player.endTurn();
  expect(game.terrainManager.getTerrain(3, 5)).toBe(Terrain.FIRE);
});

test('Poison lasts three activations and repeated Revive restores 30 percent without a match quota', async () => {
  player.setMP(1000);
  await cast(10, ally);
  await cast(10, ally);
  const before = ally.hp;
  const ticks: number[] = [];
  for (let i = 0; i < 4; i++) {
    const hp = ally.hp;
    ally.startTurn();
    ally.endTurn();
    ticks.push(hp - ally.hp);
  }
  expect(ticks[0]).toBeGreaterThanOrEqual(8);
  expect(ticks).toEqual([ticks[0], ticks[0], ticks[0], 0]);
  expect(before - ally.hp).toBe(ticks[0] * 3);
  for (let i = 0; i < 3; i++) {
    ally.hp = 0;
    await cast(12, ally);
    expect(ally.hp).toBe(Math.round(ally.getMaxHP() * .3));
  }
  expect(player.mp).toBe(1000 - 12 * 2 - 35 * 3);
});

test.each([[0, 2], [1, 1]])('a match won over Socket.IO doubles XP only for an account with %i completed games; SP stops after forty', async (completedGames, multiplier) => {
  player.team.teamData.completedGames = completedGames;
  player.team.teamData.playerUID = 'balance-player';
  game.combatStarted = true;
  // Persistence leaves the server; the match outcome itself uses production logic.
  for (const method of ['writeOutcomesToDb', 'updateGameInDB', 'saveReplayToDb'] as const) spyOn(game, method).mockResolvedValue(undefined);
  spyOn(Math, 'random').mockReturnValue(.5);
  // One character sits at the 40-SP cap, one is a level away from it.
  player.level = 21; player.xp = getXPThreshold(21) - 1;
  ally.level = 20; ally.xp = getXPThreshold(20) - 1;
  opponent.setHP(1);
  const ended = new Promise<OutcomeData>(resolve => client.once('gameEnd', resolve));
  await action('attack', {target: 1, sameTeam: false});
  expect(opponent.isAlive()).toBe(false);
  game.checkEndGame(); // The match's once-a-second end check.
  const outcome = await ended;
  expect(outcome.isWinner).toBe(true);
  expect(outcome.xp).toBe(Math.round(opponent.level * XP_PER_LEVEL * (outcome.rewardFactor + .3) * RANKED_XP_COEF * multiplier));
  const points = Object.fromEntries(outcome.characters!.map(character => [character.num, character]));
  expect(points[player.num].level).toBeGreaterThan(0);
  expect(points[player.num].points).toBe(0);
  expect(points[ally.num].level).toBeGreaterThan(0);
  expect(points[ally.num].points).toBe(2);
});

test('combat samples measure PvP damage progression separately from adaptive AI duels', async () => {
  const report: object[] = [];
  for (const level of [1, 10, 21]) {
    for (const build of ['baseline', 'offense', 'defense'] as const) {
      stats(player, Class.WARRIOR, level);
      stats(opponent, Class.BLACK_MAGE, level);
      if (build === 'offense') player.stats[Stat.ATK] += Math.min(20, (level - 1) * 2);
      if (build === 'defense') opponent.stats[Stat.DEF] += Math.min(20, (level - 1) * 2);
      const hp = opponent.hp;
      let hits = 0;
      while (opponent.isAlive() && hits < 30) {
        player.hasActed = false;
        game.turnee = player;
        await action('attack', {target: 1, sameTeam: false});
        expect(player.hasActed).toBe(true);
        hits++;
      }
      expect(opponent.hp).toBe(0);
      const attackEvent = game.replayMessages.filter(message => message.event === 'attack').at(-1)!;
      report.push({mode: 'PvP isolated melee', level, build, hp, damage: -attackEvent.data.damage, hits});
    }
  }
  function maximizeEquipment(unit: ServerPlayer, stat: Stat) {
    const value = item => item.effects.filter(effect => effect.stat === stat).reduce((sum, effect) => sum + effect.value, 0);
    for (const [slot, field] of Object.entries(equipmentSlotFields)) {
      const candidates = equipments.filter(item => item.slot === (Number(slot) === EquipmentSlot.RIGHT_RING ? EquipmentSlot.LEFT_RING : Number(slot)) &&
        (!item.classes.length || item.classes.includes(unit.class)));
      candidates.sort((a, b) => value(b) - value(a));
      unit.equipment[field] = candidates[0]?.id ?? -1;
    }
    const bonuses = applyEquipmentBonuses(unit.equipment);
    for (const [key, field] of Object.entries(StatFields)) unit.stats[key] += bonuses[field];
    unit.hp = unit.getMaxHP();
    unit.mp = unit.getMaxMP();
  }
  for (const protectedTarget of [false, true]) {
    for (let id = 0; id < 9; id++) {
      stats(player, Class.BLACK_MAGE, 21);
      player.stats[Stat.SPATK] += 20;
      maximizeEquipment(player, Stat.SPATK);
      player.setMP(1000);
      stats(opponent, Class.BLACK_MAGE, 21);
      if (protectedTarget) {
        opponent.stats[Stat.SPDEF] += 20;
        opponent.setHP(opponent.hp + 40);
        maximizeEquipment(opponent, Stat.SPDEF);
      }
      game.updatePlayerPosition(opponent, 5, 5);
      opponent.clearStatusEffects();
      const hp = opponent.hp;
      await cast(id);
      const dealt = hp - opponent.hp;
      expect(dealt).toBeGreaterThan(0);
      expect(dealt).toBeLessThan(hp);
      report.push({mode: 'PvP max magic equipment + 20 SP', spell: getSpellById(id).name,
        attack: player.getStat(Stat.SPATK), defense: opponent.getStat(Stat.SPDEF), hp,
        protectedTarget, damage: dealt, directHits: Math.ceil(hp / dealt)});
    }
  }
  // Same combat/initiative engine, but the second side now chooses its own actions.
  const {AIServerPlayer} = await import('../AIServerPlayer');
  for (const scale of [.6, 1, 1.5]) {
    stats(player, Class.WARRIOR);
    player.clearStatusEffects();
    player.activeTerrainDoT = null;
    player.spells = [];
    player.inventory = [];
    game.teams.get(1).members = [player];
    game.teams.get(2).members = [];
    const ai = new AIServerPlayer(1, 'Adaptive mage', '2_5', 2, 5);
    stats(ai, Class.BLACK_MAGE);
    ai.spells = [new Spell(getSpellById(0)), new Spell(getSpellById(3))];
    ai.inventory = [];
    game.teams.get(2).addMember(ai);
    ai.team.teamData.AIwinRatio = 1;
    ai.scaleStats(scale); // Preserve the production difficulty multiplier, including HP/MP behavior.
    game.freeCell(opponent.x, opponent.y);
    game.updatePlayerPosition(player, 1, 5);
    game.occupyCell(ai.x, ai.y, ai);
    game.terrainManager.terrainMap.clear();
    game.terrainManager.fireDamage.clear();
    game.turnSystem.initializeTurnOrder([player, ai]);
    const aiHP = ai.hp;
    const aiMP = ai.mp;
    let activations = 0;
    const before = ai.team.actions;
    while (player.isAlive() && ai.isAlive() && activations < 100) {
      const actor = game.turnSystem.getNextActor();
      game.turnee = actor;
      actor.hasActed = false;
      scheduled.length = 0;
      actor.startTurn();
      if (actor.canAct() && !actor.hasActed) {
        if (actor === ai) ai.takeAction();
        else await action('attack', {target: 1, sameTeam: false});
      }
      // Advance casts and movement effects, retaining the production TurnSystem schedule.
      while (scheduled.length) scheduled.shift()!();
      actor.endTurn();
      activations++;
    }
    expect(activations).toBeLessThan(100);
    expect(ai.team.actions - before).toBeGreaterThan(0);
    report.push({mode: 'AI duel', scale, aiHP, aiMP, activations, winner: player.isAlive() ? 'warrior' : 'AI mage'});
  }
  console.log('BALANCE_SIMULATION', JSON.stringify(report));
});
