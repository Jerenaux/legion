import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {Server, Socket} from 'socket.io';
import {AIServerPlayer} from '../AIServerPlayer';
import {TowerGame} from '../TowerGame';
import {TurnSystem} from '../TurnSystem';
import {createTowerRun, TOWER_ENCOUNTERS, TOWER_UPGRADES, chooseTowerUpgrade, finishTowerBattle, towerOffers} from '@legion/shared/tower';
import {League, PlayMode, StatusEffect, Terrain} from '@legion/shared/enums';
import {getSpellById} from '@legion/shared/Spells';
import {isSkip} from '@legion/shared/utils';

const games: TowerGame[] = [];
afterEach(() => { games.splice(0).forEach(game => { game.combatClock.dispose(); clearInterval(game.checkEndTimer!); clearInterval(game.audienceTimer!); }); mock.restore(); });
async function battle(floor = 0, route = 0) {
  const run = createTowerRun('run', 1, 'balanced');
  run.floor = floor; run.phase = 'battle'; run.path[floor] = TOWER_ENCOUNTERS[floor][route].id;
  const game = new TowerGame('tower-test', PlayMode.TOWER, League.BRONZE, {in: () => ({emit: mock()})} as unknown as Server, run);
  games.push(game);
  await game.getRemoteConfig(); game.generateHoles(); await game.populateTeams(); game.populateGrid();
  game.turnSystem = new TurnSystem(); game.turnSystem.initializeTurnOrder([...game.getTeam(1), ...game.getTeam(2)]);
  return game;
}

test('all authored encounters have valid, distinct spawns and traversable starting tiles', async () => {
  for (const [floor, encounters] of TOWER_ENCOUNTERS.entries()) for (const route of encounters.keys()) {
    const game = await battle(floor, route);
    const units = [...game.getTeam(1), ...game.getTeam(2)];
    expect(new Set(units.map(unit => `${unit.x},${unit.y}`)).size).toBe(units.length);
    for (const unit of units) {
      expect(isSkip(unit.x, unit.y)).toBe(false);
      expect(game.hasObstacle(unit.x, unit.y)).toBe(false);
      expect(game.listCellsInRange(unit.x, unit.y, unit.distance).length).toBeGreaterThan(0);
    }
  }
});

test('temporary upgrade effects reach combat without mutating shared spells', async () => {
  const game = await battle();
  const originalCost = getSpellById(6)!.cost;
  game.run.phase = 'choice'; game.run.offers = ['frostcraft'];
  chooseTowerUpgrade(game.run, 'frostcraft');
  game.teams.forEach(team => { team.members = []; });
  await game.populateTeams();
  expect(game.getTeam(1)[2].spells.find(spell => spell.id === 6)?.cost).toBe(15);
  expect(getSpellById(6)!.cost).toBe(originalCost);
});

test('full run choices and banked rewards survive independently of permanent characters', () => {
  const run = createTowerRun('full-run', 1, 'balanced');
  const original = structuredClone(run.squad);
  for (let floor = 0; floor < 6; floor++) {
    run.phase = 'battle'; run.path.push(TOWER_ENCOUNTERS[floor][0].id);
    const reward = finishTowerBattle(run, {won: true, units: run.squad.map(() => ({hp: 1, mp: 0, inventory: []}))});
    expect(reward.gold).toBeGreaterThan(0);
    expect(run.squad.every(unit => unit.hp > unit.character.stats.hp * 0.3)).toBe(true);
    if (floor < 5) {
      expect(run.offers).toEqual(towerOffers(run));
      expect(run.offers.every(id => TOWER_UPGRADES.some(upgrade => upgrade.id === id))).toBe(true);
      expect(() => chooseTowerUpgrade(run, 'invalid')).toThrow();
      chooseTowerUpgrade(run, run.offers[2]);
      expect(() => chooseTowerUpgrade(run, 'rest')).toThrow();
    }
  }
  expect(run.phase).toBe('won'); expect(run.floor).toBe(6);
  expect(run.earned.gold).toBe(555); expect(run.earned.xp).toBe(900); expect(run.earned.items).toHaveLength(4);
  expect(original[2].character.skills).toEqual([0]);
  expect(() => finishTowerBattle(run, {won: true, units: []})).toThrow();
});

test('untimed humans, AI fallback, and ice thaw prevent stuck encounters', async () => {
  const game = await battle();
  const schedule = spyOn(game.combatClock, 'schedule').mockReturnValue(1);
  game.turnee = game.getTeam(1)[0]; game.resetTurnTimer();
  expect(schedule).not.toHaveBeenCalled();
  game.turnee = game.getTeam(2)[0]; game.resetTurnTimer();
  expect(schedule.mock.calls[0][1]).toBe(5000);
  const unit = game.turnee;
  unit.statuses[StatusEffect.FREEZE] = -1;
  game.terrainManager.updateTerrainMap(Terrain.ICE, unit.x, unit.y);
  game.resetTurnTimer(); game.resetTurnTimer(); expect(unit.isFrozen()).toBe(true);
  game.resetTurnTimer(); expect(unit.isFrozen()).toBe(false); expect(game.hasObstacle(unit.x, unit.y)).toBe(false);
});

test('boss warns before attacking and moving away avoids the blast', async () => {
  const game = await battle(5);
  const boss = game.getTeam(2)[0] as AIServerPlayer & {markBlast(): void};
  const broadcast = spyOn(game, 'broadcast');
  const target = game.getTeam(1)[1];
  boss.markBlast();
  const warned = broadcast.mock.calls.find(call => call[0] === 'towerWarning')![1] as {x: number; y: number}[];
  expect(warned.some(tile => tile.x === target.x && tile.y === target.y)).toBe(true);
  const hp = target.hp;
  game.freeCell(target.x, target.y); target.updatePos(4, 9); game.occupyCell(target.x, target.y, target);
  boss.takeAction(); expect(target.hp).toBe(hp);
  boss.die(); expect(broadcast.mock.calls.at(-1)).toEqual(['towerWarning', []]);
});

test('readiness gates tower combat and disconnect pauses it', async () => {
  const game = await battle();
  const connection = {uid: 'p1', connected: true, handshake: {auth: {combatReady: 1}}, emit: mock(), join() {}, leave() {}} as unknown as Socket;
  const team = game.teams.get(1)!; team.teamData.playerUID = 'p1'; team.setSocket(connection);
  game.sockets.push(connection); game.socketMap.set(connection, team);
  game.startGame(); expect(game.combatStarted).toBe(false);
  const snapshot = (connection.emit as ReturnType<typeof mock>).mock.calls.find(call => call[0] === 'gameStatus')![1];
  expect(snapshot.general.tower.floor).toBe(1); expect(snapshot.turnee.turnDuration).toBe(0);
  game.handleArenaReady(connection, snapshot.general.readyToken); expect(game.combatStarted).toBe(true);
  game.handleDisconnect(connection); expect(game.combatClock.paused).toBe(true);
  spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"saved":true}'));
  expect(game.hasPendingResult).toBe(false);
  game.endGame(2);
  expect(game.hasPendingResult).toBe(true);
});


test('an expired reconnect can restart its checkpoint without a normal match result', async () => {
  const game = await battle();
  const connection = {uid: 'p1', connected: true, handshake: {auth: {combatReady: 1}}, emit: mock(), join() {}, leave() {}} as unknown as Socket;
  const team = game.teams.get(1)!; team.teamData.playerUID = 'p1'; team.setSocket(connection);
  game.sockets.push(connection); game.socketMap.set(connection, team);
  game.startGame();
  const snapshot = (connection.emit as ReturnType<typeof mock>).mock.calls.find(call => call[0] === 'gameStatus')![1];
  game.handleArenaReady(connection, snapshot.general.readyToken);
  const timers = spyOn(globalThis, 'setTimeout');
  game.handleDisconnect(connection);
  const deadline = timers.mock.calls.find(call => call[1] === 120_000)![0];
  deadline();
  expect(game.gameOver).toBe(true);
  expect(game.hasPendingResult).toBe(false);
  expect(game.gameOutcomes.size).toBe(0);
});
