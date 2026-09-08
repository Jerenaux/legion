import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test';
import {Server, Socket} from 'socket.io';
import {Class, League, PlayMode, Stat, StatusEffect, Terrain} from '@legion/shared/enums';
import {getSpellById} from '@legion/shared/Spells';
import {getConsumableById} from '@legion/shared/Items';
import {Game} from '../Game';
import {ServerPlayer} from '../ServerPlayer';
import {AIServerPlayer} from '../AIServerPlayer';
import {Spell} from '../Spell';
import {Item} from '../Item';
import {TurnSystem} from '../TurnSystem';

class TestGame extends Game {
  populateTeams() {}
}

let game: TestGame;
let player: ServerPlayer;
let enemy: AIServerPlayer;
let socket: Socket;
let scheduled: (() => void)[];

beforeEach(() => {
  const channel = {emit: mock()};
  game = new TestGame('local-action-regression', PlayMode.TUTORIAL, League.BRONZE, {in: () => channel} as unknown as Server);
  player = new ServerPlayer(1, 'Mage', '1_5', 1, 5);
  enemy = new AIServerPlayer(1, 'Rival', '1_1', 3, 5);
  for (const [unit, teamId] of [[player, 1], [enemy, 2]] as const) {
    unit.setHP(100);
    unit.setMP(100);
    unit.stats[Stat.ATK] = 10;
    unit.stats[Stat.DEF] = 10;
    unit.stats[Stat.SPEED] = 10;
    unit.class = Class.BLACK_MAGE;
    unit.equipment = {};
    game.teams.get(teamId).addMember(unit);
    game.occupyCell(unit.x, unit.y, unit);
  }
  player.spells = [new Spell(getSpellById(0)), new Spell(getSpellById(9))];
  player.inventory = [new Item(getConsumableById(0)), new Item(getConsumableById(8))];
  socket = {emit: mock()} as unknown as Socket;
  game.socketMap.set(socket, player.team);
  player.team.setSocket(socket);
  game.gameStarted = true;
  game.config = {};
  game.turnee = player;
  game.turnSystem = new TurnSystem();
  game.turnSystem.initializeTurnOrder([player, enemy]);
  spyOn(game.turnSystem, 'processAction');
  spyOn(globalThis, 'clearTimeout');
  spyOn(game, 'processTurn').mockImplementation(() => {});
  spyOn(game, 'saveGameAction').mockResolvedValue(undefined);
  spyOn(game, 'saveInventoryToDb').mockResolvedValue(undefined);
  spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network access is forbidden in action regression tests'));
  scheduled = [];
  spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void) => {
    scheduled.push(callback);
    return 0;
  }) as unknown as typeof setTimeout);
});

afterEach(() => {
  try {expect(globalThis.fetch).not.toHaveBeenCalled();}
  finally {mock.restore();}
});

const invalidActions = [
  {name: 'out-of-range spell', action: 'spell', data: {x: 14, y: 5, index: 0}},
  {name: 'missing spell', action: 'spell', data: {x: 3, y: 5, index: 99}},
  {name: 'missing spell target', action: 'spell', data: {x: 3, y: 5, index: 1, targetTeam: 2, target: 99}},
  {name: 'dead spell target', action: 'spell', data: {x: 3, y: 5, index: 1, targetTeam: 2, target: 1}, prepare: () => {enemy.hp = 0;}},
  {name: 'forged spell coordinates', action: 'spell', data: {x: 3, y: 5, index: 1, targetTeam: 2, target: 1}, prepare: () => game.updatePlayerPosition(enemy, 14, 5)},
  {name: 'silenced caster', action: 'spell', data: {x: 3, y: 5, index: 0}, prepare: () => {player.statuses[StatusEffect.MUTE] = 1;}},
  {name: 'insufficient MP', action: 'spell', data: {x: 3, y: 5, index: 0}, prepare: () => {player.mp = 0;}},
  {name: 'occupied move', action: 'move', data: {tile: {x: 3, y: 5}}},
  {name: 'out-of-range move', action: 'move', data: {tile: {x: 12, y: 5}}},
  {name: 'missing move tile', action: 'move', data: {}},
  {name: 'missing attack target', action: 'attack', data: {target: 99, sameTeam: false}},
  {name: 'unreachable attack', action: 'attack', data: {target: 1, sameTeam: false}, prepare: () => {spyOn(game, 'listCellsInRange').mockReturnValue([]);}},
  {name: 'missing obstacle', action: 'obstacleattack', data: {x: 2, y: 5}},
  {name: 'unneeded potion', action: 'useitem', data: {index: 0}},
  {name: 'missing item', action: 'useitem', data: {index: 99}},
  {name: 'missing item target', action: 'useitem', data: {index: 1, targetTeam: 2, target: 99}},
  {name: 'out-of-range revival', action: 'useitem', data: {x: 3, y: 5, index: 1, targetTeam: 2, target: 1}, prepare: () => {enemy.hp = 0; game.updatePlayerPosition(enemy, 14, 5);}},
  {name: 'malformed spell payload', action: 'spell', data: null},
  {name: 'non-integer spell coordinates', action: 'spell', data: {x: 3.5, y: 5, index: 0}},
  {name: 'unknown action', action: 'unknown', data: {}},
];

for (const scenario of invalidActions) {
  test(`${scenario.name} leaves the turn/resources intact and permits passing`, () => {
    scenario.prepare?.();
    const mpBefore = player.getMP();
    game.processAction(scenario.action, scenario.data, socket);
    expect(player.hasActed).toBe(false);
    expect(player.getMP()).toBe(mpBefore);
    expect(player.inventory.length).toBe(2);
    expect(player.team.actions).toBe(0);
    expect(game.turnSystem.processAction).not.toHaveBeenCalled();
    expect(globalThis.clearTimeout).not.toHaveBeenCalled();
    expect(game.saveGameAction).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith('actionRejected', expect.objectContaining({team: 1, num: 1, turnNumber: 0}));

    game.processAction('passTurn', null, socket);
    expect(player.hasActed).toBe(true);
    expect(player.team.actions).toBe(1);
    expect(game.turnSystem.processAction).toHaveBeenCalledTimes(1);
    expect(game.processTurn).toHaveBeenCalledTimes(1);
  });
}

test('an out-of-range cast can be followed by a real move, without allowing a second action', () => {
  game.processAction('spell', {x: 14, y: 5, index: 0}, socket);
  game.processAction('move', {tile: {x: 2, y: 5}}, socket);
  game.processAction('passTurn', null, socket);
  expect(player.x).toBe(2);
  expect(player.hasActed).toBe(true);
  expect(player.team.actions).toBe(1);
  expect(player.team.movements).toBe(1);
  expect(game.turnSystem.processAction).toHaveBeenCalledTimes(1);
  expect(game.saveGameAction).toHaveBeenCalledTimes(1);
});

test('a valid spell spends MP once, locks the action during casting, and applies damage', () => {
  const data = {x: 3, y: 5, index: 0};
  game.processAction('spell', data, socket);
  game.processAction('spell', data, socket);
  game.processAction('passTurn', null, socket);
  expect(player.getMP()).toBe(100 - player.spells[0].cost);
  expect(player.hasActed).toBe(true);
  expect(player.team.actions).toBe(1);
  expect(player.team.spellCasts).toBe(1);
  expect(globalThis.clearTimeout).toHaveBeenCalledTimes(1);
  expect(scheduled.length).toBe(1);
  expect(game.saveGameAction).toHaveBeenCalledTimes(1);
  scheduled[0]();
  expect(enemy.getHP()).toBeLessThan(100);
  expect(game.turnSystem.processAction).toHaveBeenCalledTimes(1);
  expect(game.processTurn).toHaveBeenCalledTimes(1);
});

test('successful items, attacks, and obstacle attacks still consume exactly one action', () => {
  player.hp = 50;
  game.processAction('useitem', {index: 0}, socket);
  expect(player.hp).toBe(100);
  expect(player.inventory.length).toBe(1);
  expect(player.hasActed).toBe(true);

  player.hasActed = false;
  game.updatePlayerPosition(enemy, 2, 5);
  game.processAction('attack', {target: 1, sameTeam: false}, socket);
  expect(enemy.hp).toBeLessThan(100);
  expect(player.hasActed).toBe(true);

  player.hasActed = false;
  game.terrainManager.terrainMap.set('1,4', Terrain.ICE);
  game.processAction('obstacleattack', {x: 1, y: 4}, socket);
  expect(game.hasObstacle(1, 4)).toBe(false);
  expect(player.hasActed).toBe(true);
  expect(player.team.actions).toBe(3);
  expect(game.turnSystem.processAction).toHaveBeenCalledTimes(3);
});

test('an attack that becomes movement and direct AI actions use the same acceptance gate', () => {
  game.processAction('attack', {target: 1, sameTeam: false}, socket);
  expect(player.x).toBe(2);
  expect(player.team.actions).toBe(1);
  expect(player.hasActed).toBe(true);

  game.turnee = enemy;
  enemy.attack(player);
  enemy.attack(player);
  expect(player.hp).toBeLessThan(100);
  expect(enemy.hasActed).toBe(true);
  expect(enemy.team.actions).toBe(1);
  expect(game.turnSystem.processAction).toHaveBeenCalledTimes(2);
});
