import {expect, mock, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {PlayMode} from '@legion/shared/enums';

// Exercise the real socket entry point without starting the production server.
const source = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const connection = source.slice(source.indexOf("io.on('connection',"), source.indexOf('const gameCleanupTimer'));
const code = ts.transpileModule(connection, {compilerOptions: {target: ts.ScriptTarget.ESNext}}).outputText;

test('disabled Tower refuses joins to existing battles while other modes still reconnect', async () => {
  for (const mode of [PlayMode.TOWER, PlayMode.PRACTICE, PlayMode.CASUAL, PlayMode.RANKED]) {
    let connect!: (socket: unknown) => Promise<void>;
    const game = {gameOver: false, gameStarted: true, reconnectPlayer: mock()};
    const socket = {uid: 'p1', connected: true, handshake: {auth: {gameId: 'existing'}}, emit: mock(), disconnect: mock(), on: mock()};
    const getPlayerData = mock();
    runInNewContext(code, {ENABLE_CINDER_TOWER: false, PlayMode,
      io: {on: (_event: string, callback: typeof connect) => {connect = callback;}},
      getGameData: async () => ({players: ['p1'], mode}), getPlayerData,
      gamesMap: new Map([['existing', game]]), socketMap: new Map(),
      shortToken: (uid: string) => uid, console: {log() {}, error: mock()},
    });
    await connect(socket);
    expect(socket.disconnect.mock.calls.length).toBe(mode === PlayMode.TOWER ? 1 : 0);
    expect(game.reconnectPlayer.mock.calls.length).toBe(mode === PlayMode.TOWER ? 0 : 1);
    if (mode === PlayMode.TOWER) expect(socket.emit.mock.calls[0][0]).toBe('joinError');
    expect(getPlayerData).not.toHaveBeenCalled();
  }
});
