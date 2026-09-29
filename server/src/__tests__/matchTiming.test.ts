import {afterEach, beforeEach, expect, mock, spyOn, test} from 'bun:test';
import {Server, Socket} from 'socket.io';
import {Game} from '../Game';
import {AIServerPlayer} from '../AIServerPlayer';
import {ServerPlayer} from '../ServerPlayer';
import {Class, League, PlayMode, Stat} from '@legion/shared/enums';
import {Spell} from '../Spell';
import {getSpellById} from '@legion/shared/Spells';

class TimingGame extends Game { populateTeams() {} }

// Virtual wall and monotonic time: minutes of loading/disconnection in milliseconds,
// while exercising the actual turn scheduler, ready handlers and combat effects.
let now: number;
let nextId: number;
let timers: Map<number, {callback: () => void; due: number; interval?: number}>;
let games: TimingGame[];

function advance(ms: number) {
    const end = now + ms;
    for (;;) {
        const entry = [...timers].filter(([, job]) => job.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!entry) break;
        const [id, job] = entry;
        now = job.due;
        if (job.interval) job.due += job.interval;
        else timers.delete(id);
        job.callback();
    }
    now = end;
}

beforeEach(() => {
    now = 0; nextId = 0; timers = new Map(); games = [];
    spyOn(performance, 'now').mockImplementation(() => now);
    spyOn(Date, 'now').mockImplementation(() => 1_700_000_000_000 + now);
    spyOn(globalThis, 'setTimeout').mockImplementation(((callback, delay = 0) => {
        const id = ++nextId;
        timers.set(id, {callback, due: now + delay});
        return id;
    }) as typeof setTimeout);
    spyOn(globalThis, 'setInterval').mockImplementation(((callback, delay) => {
        const id = ++nextId;
        timers.set(id, {callback, due: now + delay, interval: delay});
        return id;
    }) as typeof setInterval);
    spyOn(globalThis, 'clearTimeout').mockImplementation(((id: number) => { timers.delete(id); }) as typeof clearTimeout);
    spyOn(globalThis, 'clearInterval').mockImplementation(((id: number) => { timers.delete(id); }) as typeof clearInterval);
    spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No external access in timing tests'));
});

afterEach(() => {
    for (const game of games) game.combatClock.dispose();
    try { expect(fetch).not.toHaveBeenCalled(); }
    finally { mock.restore(); }
});

function socket(uid: string, modern = true) {
    return {uid, handshake: {auth: modern ? {combatReady: 1} : {}},
        emit: mock(), join() {}, leave() {}, disconnect() {}} as unknown as Socket;
}

function createGame(mode = PlayMode.PRACTICE, completedGames = 0, modern = true) {
    const game = new TimingGame('local-timing', mode, League.BRONZE, {in: () => ({emit() {}})} as unknown as Server);
    games.push(game);
    game.nbExpectedPlayers = mode === PlayMode.CASUAL ? 2 : 1;
    game.config = {};
    game.turnDuration = completedGames === 0 ? 60 : 7;
    for (const method of ['saveReplayToDb', 'updateGameInDB', 'incrementStartedGames', 'saveGameAction', 'saveInventoryToDb', 'writeOutcomesToDb'] as const) {
        spyOn(game, method).mockResolvedValue(undefined);
    }
    const sockets = [socket('player-1', modern)];
    if (mode === PlayMode.RANKED_VS_AI) game.teams.get(2)!.teamData.playerUID = 'offline-roster-owner';
    if (mode === PlayMode.CASUAL) sockets.push(socket('player-2', modern));
    for (const [index, connection] of sockets.entries()) {
        const team = game.teams.get(index + 1)!;
        team.teamData.playerUID = `player-${index + 1}`;
        team.teamData.completedGames = completedGames;
        team.setSocket(connection);
        game.socketMap.set(connection, team);
        game.sockets.push(connection);
    }
    for (const id of [1, 2]) {
        const unit = id === 1 || sockets.length === 2
            ? new ServerPlayer(1, 'Mage', '1_5', id, 5)
            : new AIServerPlayer(1, 'Enemy', '1_1', id, 5);
        unit.setHP(100); unit.setMP(100); unit.equipment = {};
        unit.stats[Stat.SPEED] = id === 1 ? 20 : 10;
        unit.stats[Stat.ATK] = unit.stats[Stat.DEF] = 10;
        unit.class = Class.BLACK_MAGE;
        unit.spells = [new Spell(getSpellById(0))];
        game.teams.get(id)!.addMember(unit);
        game.occupyCell(unit.x, unit.y, unit);
    }
    game.startGame();
    return {game, sockets};
}

function snapshot(connection: Socket) {
    return (connection.emit as ReturnType<typeof mock>).mock.calls.findLast(call => call[0] === 'gameStatus')![1];
}
function ready(game: Game, connection: Socket) { game.handleArenaReady(connection, snapshot(connection).general.readyToken); }

for (const completed of [0, 12]) {
    for (const mode of [PlayMode.PRACTICE, PlayMode.CASUAL, PlayMode.RANKED_VS_AI]) {
        test(`mode ${mode}, completed ${completed}: slow loading cannot consume the first turn`, () => {
            const {game, sockets} = createGame(mode, completed);
            advance(30_000);
            expect(game.turnNumber).toBe(0);
            expect(game.teams.get(1)!.score).toBe(0);
            expect(game.incrementStartedGames).not.toHaveBeenCalled();
            game.handleArenaReady(sockets[0], 'stale-token');
            expect(game.combatStarted).toBe(false);
            ready(game, sockets[0]);
            if (sockets.length === 2) {
                advance(30_000);
                expect(game.turnNumber).toBe(0);
                ready(game, sockets[1]);
            }
            advance(0);
            expect(game.turnNumber).toBe(1);
            expect(game.getTurneeData().timeLeft).toBe(game.turnDuration);
            for (const connection of sockets) { ready(game, connection); game.handleTeamRevealed(connection); }
            advance(1);
            expect(game.turnNumber).toBe(1);
            expect(game.incrementStartedGames).toHaveBeenCalledTimes(sockets.length);
        });
    }
}

test('practice reconnect freezes the exact remaining turn and rejects superseded socket acknowledgements', () => {
    const {game, sockets: [old]} = createGame();
    ready(game, old); advance(1000);
    const remaining = game.getTurneeData().timeLeft;
    game.handleDisconnect(old);
    advance(60_000);
    expect(game.turnNumber).toBe(1);
    expect(game.getTurneeData().timeLeft).toBe(remaining);
    const replacement = socket('player-1');
    game.reconnectPlayer(replacement);
    expect(snapshot(replacement).general.combatStarted).toBe(true);
    expect(snapshot(replacement).turnee.timeLeft).toBe(remaining);
    ready(game, old);
    game.handleArenaReady(replacement, snapshot(old).general.readyToken);
    advance(1000);
    expect(game.combatClock.paused).toBe(true);
    ready(game, replacement);
    game.handleDisconnect(old);
    advance(1000);
    expect(game.combatClock.paused).toBe(false);
    expect(game.getTurneeData().timeLeft).toBe(remaining - 1);
});

test('practice recovery freezes an in-flight fireball and resumes it only once', () => {
    const {game, sockets: [old]} = createGame();
    ready(game, old); advance(0);
    const player = game.turnee!;
    game.processAction('spell', {x: 2, y: 5, index: 0}, old);
    expect(player.isCasting).toBe(true);
    const enemy = game.teams.get(2)!.members[0];
    const hp = enemy.hp;
    game.handleDisconnect(old);
    advance(60_000);
    expect(enemy.hp).toBe(hp);
    expect(player.isCasting).toBe(true);
    const replacement = socket('player-1');
    game.reconnectPlayer(replacement);
    const apply = spyOn(game, 'applyMagic');
    ready(game, replacement);
    advance(2100);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(player.isCasting).toBe(false);
    expect(enemy.hp).toBeLessThan(hp);
});

test('practice recovery pauses a pending AI decision', () => {
    const {game, sockets: [old]} = createGame();
    ready(game, old); advance(0);
    game.processPassTurn(); advance(0);
    const enemy = game.teams.get(2)!.members[0] as AIServerPlayer;
    expect(game.turnee).toBe(enemy);
    const action = spyOn(enemy, 'takeAction').mockReturnValue(0);
    game.handleDisconnect(old); advance(60_000);
    expect(action).not.toHaveBeenCalled();
    const replacement = socket('player-1');
    game.reconnectPlayer(replacement); ready(game, replacement);
    advance(2100);
    expect(action).toHaveBeenCalledTimes(1);
});

test('established PvP does not pause or renew a timer when a player reconnects', () => {
    const {game, sockets} = createGame(PlayMode.CASUAL, 12);
    sockets.forEach(connection => { ready(game, connection); }); advance(0);
    game.handleDisconnect(sockets[0]); advance(8000);
    expect(game.turnNumber).toBe(2);
    const replacement = socket('player-1');
    game.reconnectPlayer(replacement);
    const remaining = game.getTurneeData().timeLeft;
    ready(game, replacement); advance(1000);
    expect(game.turnNumber).toBe(2);
    expect(game.getTurneeData().timeLeft).toBe(remaining - 1);
});

test('abandoned readiness times out without granting rewards or advancing onboarding', () => {
    const {game, sockets: [connection]} = createGame();
    advance(120_000);
    expect(game.gameOver).toBe(true);
    expect(game.turnNumber).toBe(0);
    expect(game.writeOutcomesToDb).not.toHaveBeenCalled();
    expect(game.incrementStartedGames).not.toHaveBeenCalled();
    ready(game, connection); advance(1000);
    expect(game.turnNumber).toBe(0);
    expect(timers.size).toBe(0);
});

test('a loading reconnect uses a new snapshot token and still starts only once', () => {
    const {game, sockets: [old]} = createGame();
    const replacement = socket('player-1');
    game.reconnectPlayer(replacement);
    game.handleDisconnect(old);
    expect(snapshot(replacement).general.combatStarted).toBe(false);
    ready(game, old); advance(5000);
    expect(game.turnNumber).toBe(0);
    ready(game, replacement); advance(0);
    expect(game.turnNumber).toBe(1);
});

test('legacy clients remain playable, with milliseconds corrected and duplicate reveal ignored', () => {
    for (const completed of [0, 12]) {
        const {game, sockets: [connection]} = createGame(PlayMode.PRACTICE, completed, false);
        if (completed === 0) {
            advance(30_000);
            expect(game.turnNumber).toBe(0);
            game.handleTeamRevealed(connection);
            game.handleTeamRevealed(connection);
        }
        advance(3);
        expect(game.turnNumber).toBe(0);
        advance(3500);
        expect(game.turnNumber).toBe(1);
    }
});

test('scheduled effects and already queued callbacks cannot fire after cancellation', () => {
    const {game} = createGame();
    const effect = mock();
    game.combatClock.resume();
    game.combatClock.schedule(effect, 1000);
    const staleCallback = [...timers.values()].find(job => job.due === now + 1000 && !job.interval)!.callback;
    game.combatClock.pause(); game.combatClock.resume();
    staleCallback();
    expect(effect).not.toHaveBeenCalled();
    game.endGame(-1);
    advance(5000); staleCallback();
    expect(effect).not.toHaveBeenCalled();
});
