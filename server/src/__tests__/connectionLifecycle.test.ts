import {expect, test} from 'bun:test';
import {PvPGame} from '../PvPGame';
import {AIGame} from '../AIGame';
import {PlayMode, League} from '@legion/shared/enums';
import {PlayerDataForGame} from '@legion/shared/interfaces';
import {Server, Socket} from 'socket.io';

for (const GameType of [PvPGame, AIGame]) {
  test(`${GameType.name}: concurrent joins start once and a superseded disconnect preserves the new socket`, async () => {
    const game = new GameType('local-lifecycle', PlayMode.CASUAL, League.BRONZE, {} as Server);
    let starts = 0;
    let finish!: () => void;
    const gate = new Promise<void>(resolve => { finish = resolve; });
    game.getRemoteConfig = async () => { starts++; await gate; };
    game.generateHoles = () => {};
    game.populateTeams = async () => {};
    game.populateGrid = () => {};
    game.startGame = () => { game.gameStarted = true; };
    game.sendGameStatus = () => {};
    const socket = (uid: string) => ({uid, join() {}, leave() {}, emit() {}, disconnect() {}} as unknown as Socket);
    const a = socket('a'), b = socket('b'), replacement = socket('a');
    await game.addPlayer(a, {uid: 'a'} as PlayerDataForGame);
    if (GameType === PvPGame) await game.addPlayer(b, {uid: 'b'} as PlayerDataForGame);
    await game.addPlayer(replacement, {uid: 'a'} as PlayerDataForGame);
    expect(starts).toBe(1);
    expect(game.teams.get(1)?.getSocket()).toBe(replacement);
    game.handleDisconnect(a);
    expect(game.teams.get(1)?.getSocket()).toBe(replacement);
    finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    const reconnected = socket('a');
    game.reconnectPlayer(reconnected);
    game.handleDisconnect(replacement);
    expect(game.teams.get(1)?.getSocket()).toBe(reconnected);
    expect(game.sockets).toHaveLength(GameType === PvPGame ? 2 : 1);
  });
}
