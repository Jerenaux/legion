import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {Server, Socket} from 'socket.io';
import {AIServerPlayer} from '../AIServerPlayer';
import {TowerGame} from '../TowerGame';
import {TurnSystem} from '../TurnSystem';
import {createTowerRun, TOWER_ENCOUNTERS, chooseTowerUpgrade, finishTowerBattle} from '@legion/shared/tower';
import {Class, League, PlayMode, Stat, StatusEffect, Terrain} from '@legion/shared/enums';
import {getSpellById} from '@legion/shared/Spells';
import {GRID_HEIGHT} from '@legion/shared/config';
import {Spell} from '../Spell';
import {isSkip} from '@legion/shared/utils';

const games: TowerGame[] = [];
afterEach(() => { games.splice(0).forEach(game => { game.combatClock.dispose(); clearInterval(game.checkEndTimer!); clearInterval(game.bonusScoreTimer!); }); mock.restore(); });
async function battle(floor = 0, route = 0, tier = 1) {
  const run = createTowerRun('run', tier, 'balanced');
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

test('Ember Approach has a full-height fire wall, ranged enemies, and an Ice crossing', async () => {
  const game = await battle(0, 1);
  for (let y = 0; y < GRID_HEIGHT; y++) expect(game.checkIsOnFlame(7, y)).toBe(true);
  expect(game.terrainManager.getNbBurning()).toBe(GRID_HEIGHT);
  expect(game.getTeam(2)).toHaveLength(2);
  for (const enemy of game.getTeam(2)) {
    expect(enemy.class).toBe(Class.BLACK_MAGE);
    expect(enemy.x).toBeGreaterThan(7);
    expect(game.checkIsOnFlame(enemy.x, enemy.y)).toBe(false);
    const fire = enemy.spells.find(spell => spell.id === 0)!;
    expect(fire.cost).toBeLessThanOrEqual(enemy.mp);
    const target = game.scanGridForAoE(enemy, fire.radius - 1);
    expect(target).not.toBeNull();
    expect(target!.x).toBeLessThan(7);
  }
  game.terrainManager.updateTerrainFromSpell(new Spell(getSpellById(6)!), 7, 5);
  expect(game.terrainManager.getTerrain(7, 5)).toBe(Terrain.NONE);
  expect(game.hasObstacle(7, 5)).toBe(false);
  expect(game.checkIsOnFlame(7, 0)).toBe(true);
  expect(game.checkIsOnFlame(7, GRID_HEIGHT - 1)).toBe(true);
});

test('Tower uses stronger Ranked-style enemy scaling without changing the squad or lineup', async () => {
  const game = await battle();
  const sentry = game.getTeam(2)[0];
  expect(game.getTeam(2)).toHaveLength(2);
  expect(sentry.hp).toBe(180);
  expect(sentry.hp).toBe(sentry.getMaxHP());
  expect(sentry.mp).toBe(225);
  expect(sentry.mp).toBe(sentry.getMaxMP());
  expect(sentry.getStat(Stat.ATK)).toBe(13);
  expect(sentry.getStat(Stat.DEF)).toBe(6);
  expect(sentry.getStat(Stat.SPDEF)).toBe(7);
  expect(sentry.getStat(Stat.SPEED)).toBe(24);
  expect(game.getTeam(1)[0].hp).toBe(180);
  expect(game.getTeam(1)[0].getStat(Stat.ATK)).toBe(14);
  const higherTier = await battle(0, 0, 5);
  expect(higherTier.getTeam(2)[0].hp).toBe(288);
  expect(higherTier.getTeam(2)[0].getStat(Stat.ATK)).toBe(21);
  const boss = (await battle(5)).getTeam(2)[0];
  expect(boss.hp).toBe(540);
  expect(boss.getStat(Stat.SPATK)).toBe(13);
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

test('giving up reports retirement while a natural defeat remains eligible for progression', async () => {
  const request = spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"saved":true}'));
  for (const abandoned of [true, false]) {
    const game = await battle();
    game.combatStarted = true;
    const connection = {uid: 'p1'} as unknown as Socket;
    game.socketMap.set(connection, game.teams.get(1)!);
    if (abandoned) game.abandonGame(connection);
    else { game.getTeam(1).forEach(unit => {unit.hp = 0;}); game.endGame(2); }
    const body = JSON.parse(request.mock.calls.at(-1)![1]!.body as string);
    expect(body.result.abandoned).toBe(abandoned);
    expect(body.result.won).toBe(false);
    const run = structuredClone(game.run);
    finishTowerBattle(run, body.result);
    expect(run.phase).toBe(abandoned ? 'retired' : 'lost');
  }
});
