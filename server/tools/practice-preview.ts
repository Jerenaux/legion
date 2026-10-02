// Local-only practice server. Uses real combat and AI; all persistence is disabled.
// Run from server: bun tools/practice-preview.ts
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { AIGame } from '../src/AIGame';
import { Class, League, PlayMode } from '../../shared/enums';
import { NewCharacter } from '../../shared/NewCharacter';
import { remoteConfig } from '../../shared/config';
import type { CharacterData, PlayerDataForGame } from '../../shared/interfaces';

// Fail closed if a newly introduced persistence path escapes the overrides below.
globalThis.fetch = (() => { throw new Error('Network requests are disabled in the local practice preview'); }) as unknown as typeof fetch;

class PreviewGame extends AIGame {
    async getRemoteConfig() { this.config = { ...remoteConfig, AUTO_WIN: false, AUTO_DEFEAT: false }; }
    protected async getRosterData() {
        return { characters: [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].map((kind, i) => ({
            ...new NewCharacter(kind, 1, false).getCharacterData(), id: `preview-${i}`,
            name: ['Roland', 'Luna', 'Ember'][i], portrait: ['1_1', '1_7', '1_5'][i],
        })) as CharacterData[] };
    }
    async incrementStartedGames() {}
    async saveGameAction() {}
    async saveInventoryToDb() {}
    async saveReplayToDb() {}
    async writeOutcomesToDb() {}
    async updateGameInDB() {}
}

const http = createServer((_request, response) => { response.end('Local Legion practice preview'); });
const io = new Server(http, { cors: { origin: 'http://127.0.0.1:8082' } });
io.on('connection', socket => {
    const game = new PreviewGame(`preview-${socket.id}`, PlayMode.PRACTICE, League.BRONZE, io);
    Object.assign(socket, {uid: socket.id, firebaseToken: 'local-only'});
    socket.on('arenaReady', token => game.handleArenaReady(socket, token));
    for (const action of ['move', 'attack', 'obstacleattack', 'spell', 'useitem', 'passTurn']) {
        socket.on(action, data => game.processAction(action, data, socket));
    }
    socket.on('disconnect', () => game.endGame(-1));
    socket.on('abandonGame', () => game.endGame(2));
    void game.addPlayer(socket, {
        uid: socket.id, name: 'Arena Apprentice', avatar: 'default', lvl: 1,
        league: League.BRONZE, rank: -1, elo: 0, AIwinRatio: 0, completedGames: 0,
        engagementStats: {completedGames: 0}, dailyloot: {},
    } as PlayerDataForGame);
});
http.listen(8093, '127.0.0.1', () => console.log('Practice preview combat server: http://127.0.0.1:8093'));
