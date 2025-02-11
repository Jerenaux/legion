import { Server, Socket } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import * as admin from 'firebase-admin';
import jwt, { JwtPayload } from 'jsonwebtoken';
import axios from 'axios';
import {
    Client,
    GatewayIntentBits,
  } from 'discord.js';

import firebaseConfig from '@legion/shared/firebaseConfig';
import { apiFetch } from "./API";
import {eloRangeIncreaseInterval, eloRangeStart, eloRangeStep, goldRewardInterval,
    goldReward, casualModeThresholdTime, maxWaitTimeForPractice, ALLOW_SWITCHEROO_RANKED} from '@legion/shared/config';
import { PlayMode, League } from '@legion/shared/enums';
import { sendMessageToAdmin } from '@legion/shared/utils';

const discordEnabled = (process.env.DISCORD_TOKEN !== undefined);
const discordClient = new Client({intents: [GatewayIntentBits.Guilds]});
if (discordEnabled) {
    discordClient.login(process.env.DISCORD_TOKEN);
}

if (process.env.NODE_ENV === 'development') {
    admin.initializeApp(firebaseConfig);
} 

interface QueuingPlayer {
    socket: any,
    elo: number;
    range: number;
    mode: number;
    league?: League;
    waitingTime: number;
    gold: number;
}

class Lobby {
    id: string;
    creatorId: string;
    opponentId: string | null;
    creatorSocket: Socket;
    opponentSocket: Socket;
    stake: number;
    constructor(id: string, creatorId: string, opponentId: string | null = null, stake: number = 0) {
        this.id = id;
        this.creatorId = creatorId;
        this.opponentId = opponentId;
        this.creatorSocket = null;
        this.opponentSocket = null;
        this.stake = stake;
    }

    addPlayer(socket: any): boolean {
        console.log(`[matchmaker:Lobby:addPlayer] Adding player ${socket.uid} to lobby ${this.id} ...`);
        // @ts-ignore
        console.log(`[matchmaker:Lobby:addPlayer] creatorSocket: ${this.creatorSocket?.uid}, creatorId: ${this.creatorId}, isCreator: ${socket.uid === this.creatorId}, opponentSocket: ${this.opponentSocket?.uid}`);
        if (this.creatorSocket == null && socket.uid === this.creatorId) {
            this.creatorSocket = socket;
            return true;
        }
        if (this.opponentSocket == null && socket.uid != this.creatorId) {
            this.opponentSocket = socket;
            return true;
        }
        return false;
    }

    isFull(): boolean {
        // @ts-ignore
        // console.log(`[matchmaker:Lobby:isFull] creatorSocket: ${this.creatorSocket?.uid}, opponentSocket: ${this.opponentSocket?.uid}`);
        return this.creatorSocket != null && this.opponentSocket != null;
    }
}

let io: Server;
const lobbies: Map<string, Lobby> = new Map();

const playersQueue: QueuingPlayer[] = [];
const RND = true;

async function notifyAdmin(uid1: string, uid2:string, mode: PlayMode, action: string) {
    if (!discordEnabled) return;
    try {
        let message;
        if (action == 'left') {
            message = `Player ${uid1} has left the queue.`;
        } else if(action == 'joined') {
            message = `Player ${uid1} has joined the queue in ${PlayMode[mode]} mode!`;
        } else if (action == 'matched') {
            message = `Players ${uid1} and ${uid2} have been matched in ${PlayMode[mode]} mode!`;
        }
        sendMessageToAdmin(discordClient, message);
    } catch (error) {
        console.error('Failed to send DM:', error);
    }
}

export function setupMatchmaking(ioInstance: Server) {
    io = ioInstance;

    setInterval(() => {
        queueTimeUpdate();
        (async () => {
            try {
                await tryMatchPlayers();
            } catch (error) {
                console.error('Error in tryMatchPlayers:', error);
            }
        })();
    }, 1000);
}

function emitQueueCount() {
    let count = playersQueue.length;
    if (RND) {
        count = Math.floor(Math.random() * 4) + 2;
    }
    io.emit('queueCount', { count }); 
}

function removePlayerFromQ(player: QueuingPlayer) {
    if (!player) {
        console.error(`[matchmaker:removePlayerFromQ] Player not found`);
        return;
    }
    console.log(`[matchmaker:removePlayerFromQ] Removing ID ${player.socket.id}`);
    const index = playersQueue.findIndex(p => p.socket.id === player.socket.id);
    if (index !== -1) {
        savePlayerGold(player);
        playersQueue.splice(index, 1);
        emitQueueCount();
    }
}

function incrementGoldReward(player: QueuingPlayer) {
    if (player.mode != PlayMode.PRACTICE && player.waitingTime % goldRewardInterval === 0) {
        player.gold += goldReward; 
        player.socket.emit("updateGold", { gold: player.gold });
    }
}

function queueTimeUpdate() {
    playersQueue.forEach(player => {
        // console.log(`[matchnaker:queueTimeUpdate] ${player.socket.id}`);
        player.waitingTime += 1;

        incrementGoldReward(player);

        if (player.waitingTime >= eloRangeIncreaseInterval) {
            player.waitingTime = 0;
            player.range += eloRangeStep;
        }
    });
}

function switcherooCheck(player: QueuingPlayer) {
    if ((player.mode == PlayMode.CASUAL 
        || (ALLOW_SWITCHEROO_RANKED && player.mode == PlayMode.RANKED)) 
        && player.waitingTime > casualModeThresholdTime) {
        // Calculate the probability of redirecting to a PRACTICE game
        const waitTimeBeyondThreshold = player.waitingTime - casualModeThresholdTime;
        const redirectionProbability = Math.min(1, waitTimeBeyondThreshold / (maxWaitTimeForPractice - casualModeThresholdTime));

        if (Math.random() < redirectionProbability) {
            console.log(`Redirecting ${player.socket.id} to a CASUAL_VS_AI game due to long wait.`);
            const mode = player.mode == PlayMode.CASUAL ? PlayMode.CASUAL_VS_AI : PlayMode.RANKED_VS_AI;
            const league = player.mode = PlayMode.RANKED ? player.league : null;
            createGame(player.socket, null, mode, league);
            removePlayerFromQ(player);
            return true;
        }
    }
    return false;
}

async function tryMatchPlayers() {
    let i = 0;
    if (playersQueue.length > 0) {
        console.log(`[matchmaker:tryMatchPlayers] ${playersQueue.length} players in Q: ${playersQueue.map(p => p.socket.id)}`);
    }
    while (i < playersQueue.length) {
        let player1 = playersQueue[i];
        let matchFound = false;

        if (switcherooCheck(player1)) return;

        for (let j = i + 1; j < playersQueue.length; j++) {
            let player2 = playersQueue[j];
            console.log(`[matchmaker:tryMatchPlayers] Considering ${player1.socket.id} with ${player2.socket.id} ...`);
            if (player1.mode == player2.mode && canBeMatched(player1, player2)) {
                console.log(`Match found between ${player1.socket.id} and ${player2.socket.id}`);
                // Start a game for these two players
                const success = await createGame(player1.socket, player2.socket, player1.mode, player1.league);
                if (success) {
                    console.log(`[matchmaker:tryMatchPlayers] Queue: ${playersQueue.map(p => p.socket.id)}`);
                    console.log(`[matchmaker:tryMatchPlayers] Removing ${player2.socket.id} from queue`);
                    removePlayerFromQ(player2.socket); // Remove player2 first since it's later in the array
                    console.log(`[matchmaker:tryMatchPlayers] Queue: ${playersQueue.map(p => p.socket.id)}`);
                    console.log(`[matchmaker:tryMatchPlayers] Removing ${player1.socket.id} from queue`);
                    removePlayerFromQ(player1.socket);
                }
                matchFound = true;
                break;
            } else {
                if (player1.mode == player2.mode) {
                    console.log(`[matchmaker:tryMatchPlayers] Mismatchibg modes`);
                } else {
                    console.log(`[matchmaker:tryMatchPlayers] Incompatible ELOs: ${player1.elo} vs ${player2.elo}, ranges: ${player1.range} vs ${player2.range}`);
                }
            }
        }

        if (!matchFound) {
            i++;
        }
    }
}

function countQueuingPlayers(mode: PlayMode, league: League): number {
    const playersInMode =  playersQueue.filter(player => player.mode === mode);
    if (mode == PlayMode.RANKED) {
        return playersInMode.filter(player => player.league === league).length;
    }
    if (RND) {
        return Math.floor(Math.random() * 4) + 2;
    } else {
        return playersInMode.length;
    }
}

function canBeMatched(player1: QueuingPlayer, player2: QueuingPlayer): boolean {
    const isDifferentPlayers = player1.socket.uid !== player2.socket.uid;
    const isEloCompatible = Math.abs(player1.elo - player2.elo) <= player1.range && Math.abs(player1.elo - player2.elo) <= player2.range;
    const isLeagueCompatible = player1.mode != PlayMode.RANKED || player1.league == player2.league;
    return isDifferentPlayers && isEloCompatible && isLeagueCompatible;
}

async function createGame(
    player1: Socket, player2?: Socket, mode: PlayMode = PlayMode.PRACTICE, league: League | null = null, stake: number = 0
) {
    console.log(`[matchmaker:createGame] Creating game with mode ${mode} and league ${league}`);
    try {
        // Check if players can join game
        if (!(await tryJoinGame(player1))) {
            console.log(`[matchmaker:createGame] Failed to join game for player1`);
            return false;
        }
        if (player2 && !(await tryJoinGame(player2))) {
            console.log(`[matchmaker:createGame] Failed to join game for player2`);
            // Reset player1's status if player2 can't join
            console.log(`[matchmaker:createGame] Resetting player1's status to ONLINE after failed player2 join`);
            // @ts-ignore
            updatePlayerStatus(player1.uid, PlayerStatus.ONLINE);
            return false;
        }

        // Decline any pending challenges for both players
        // @ts-ignore
        declinePendingChallenge(player1.uid);
        // @ts-ignore
        if (player2) declinePendingChallenge(player2.uid);

        const gameId = uuidv4();
        await apiFetch(
            'createGame',
            '',
            {
                method: 'POST',
                body: {
                    gameId,
                    // @ts-ignore
                    players: [player1.uid, player2?.uid],
                    mode,
                    league,
                    stake,
                },
                headers: {
                    'x-api-key': process.env.API_KEY,
                }
            }
        );

        // Update status for both players
        // @ts-ignore
        updatePlayerStatus(player1.uid, PlayerStatus.INGAME, gameId);
        if (player2) {
            // @ts-ignore
            updatePlayerStatus(player2.uid, PlayerStatus.INGAME, gameId);
        }

        player1.nsp.to(player1.id).emit("matchFound", { gameId });
        if (player2)
            player2.nsp.to(player2.id).emit("matchFound", { gameId });

        // @ts-ignore
        notifyAdmin(player1?.uid, player2?.uid, mode, 'matched');
        return true;
    } catch (error) {
        console.error(`Error creating game: ${error}`);
        // Reset players' status on error
        // @ts-ignore
        updatePlayerStatus(player1.uid, PlayerStatus.ONLINE);
        if (player2) {
            // @ts-ignore
            updatePlayerStatus(player2.uid, PlayerStatus.ONLINE);
        }
        return false;
    }
}

function sendQData(player: QueuingPlayer) {
    player.socket.emit("queueData", {
        goldRewardInterval,
        goldReward,
        estimatedWaitingTime: 10,
        nbInQueue: countQueuingPlayers(player.mode, player.league),
    });
}

async function addToQueue(socket: any, mode: PlayMode) {
    try {
        const queuingData = await apiFetch(
            'queuingData',
            socket.firebaseToken,
        );
    
        const player: QueuingPlayer = {
            socket,
            elo: queuingData.elo,
            range: eloRangeStart,
            mode,
            league: queuingData.league as League,
            waitingTime: 0,
            gold: 0,
        };
        playersQueue.push(player);
        sendQData(player);
        emitQueueCount();
        // @ts-ignore
        updatePlayerStatus(socket.uid, PlayerStatus.QUEUING);
        console.log(`Player ${socket.id} joined queue  in mode ${mode} with elo ${player.elo} and league ${player.league}`);
    } catch (error) {
        console.error(`Error adding player to queue: ${error}`);
    }
}

async function savePlayerGold(player: QueuingPlayer) {
    if (player.gold == 0) return;
    try {
        await apiFetch(
            'saveGoldReward',
            '',
            {
                method: 'POST',
                body: {
                    uid: player.socket.uid, 
                    gold: player.gold,
                },
                headers: {
                    'x-api-key': process.env.API_KEY,
                }
            }
        );
        console.log(`Saved ${player.gold} gold for player ${player.socket.id}`);
    } catch (error) {
        console.error(`Error saving player gold: ${error}`);
    }
}

async function logQueuingActivity(playerId: string, actionType: string, details: any) {
    console.log(`Logging queuing activity: ${playerId}, ${actionType}, ${details}`);
    try {
        await apiFetch(
            'logQueuingActivity',
            '',
            {
                method: 'POST',
                body: {
                    playerId,
                    actionType,
                    details,
                },
                headers: {
                    'x-api-key': process.env.API_KEY,
                }
            }
        );
    } catch (error) {
        console.error(`Error logging queuing activity: ${error}`);
    }
}

async function getUID(IDToken) {
    if (process.env.NODE_ENV === 'development') {
        return (await admin.auth().verifyIdToken(IDToken)).uid;
    } else {
        return await validateFirebaseIdToken(IDToken, firebaseConfig.projectId);
    }
}

export async function processJoinQueue(socket, data: { mode: PlayMode }) {
    try {
        console.log(`[matchmaker:processJoinQueue] Player ${socket.id} joining queue in mode ${data.mode} ...`);

        if (data.mode == PlayMode.PRACTICE) {
            notifyAdmin(socket.uid, null, data.mode, 'joined');
            createGame(socket, null, PlayMode.PRACTICE);
            return;
        }

        // Return if the player is already in the queue
        if (playersQueue.some(player => player.socket.id === socket.id)) {
            return;
        }

        notifyAdmin(socket.uid, null, data.mode, 'joined');
        addToQueue(socket, data.mode);
        logQueuingActivity(socket.uid, 'joinQueue', data.mode);
    } catch (error) {
        if (error.code === 'auth/id-token-revoked') {
            console.log('The Firebase ID token has been revoked.');
            socket.emit('authError', { message: 'Your session has expired. Please log in again.' });
        } else {
            console.error('Error verifying Firebase ID token:', error);
            socket.emit('authError', { message: 'Authentication failed. Please try again.' });
        }
    }
}

export async function processJoinLobby(socket, data: { lobbyId: string }) {
    try {
        // Check if player can join a game
        if (!(await tryJoinGame(socket))) {
            socket.emit('lobbyError', { 
                message: 'Cannot join lobby while in another game' 
            });
            return;
        }

        // Get lobby details first
        const lobbyDetails = await apiFetch(
            `getLobbyDetails?lobbyId=${data.lobbyId}`,
            socket.firebaseToken
        );

        // Remove player from queue if they're in one
        const queuePlayer = playersQueue.find(player => player.socket.id === socket.id);
        if (queuePlayer) {
            removePlayerFromQ(queuePlayer);
        }

        // Determine play mode based on lobby type
        const mode = lobbyDetails.type === 'friend' ? 
            PlayMode.CASUAL_VS_FRIEND : 
            PlayMode.STAKED;

        const lobby = lobbies.get(data.lobbyId);
        if (!lobby) {
            // Create new lobby instance with opponentId from lobbyDetails
            const newLobby = new Lobby(
                data.lobbyId, 
                lobbyDetails.creatorId,
                lobbyDetails.opponentId, 
                lobbyDetails.stake
            );
            lobbies.set(data.lobbyId, newLobby);
            
            if (!newLobby.addPlayer(socket)) {
                socket.emit('lobbyError', { message: 'Failed to join lobby' });
                return;
            }

            // Update player status
            updatePlayerStatus(socket.uid, PlayerStatus.QUEUING);
            
            // Send lobby details along with the join confirmation
            socket.emit('lobbyJoined', { 
                lobbyId: data.lobbyId,
                type: lobbyDetails.type,
                opponentName: lobbyDetails.type === 'friend' ? 
                    (socket.uid === lobbyDetails.creatorId ? lobbyDetails.opponentNickname : lobbyDetails.nickname) : 
                    null
            });
            return;
        }

        if (lobby.isFull()) {
            socket.emit('lobbyError', { message: 'Lobby is full' });
            return;
        }

        if (!lobby.addPlayer(socket)) {
            socket.emit('lobbyError', { message: 'Failed to join lobby' });
            return;
        }

        // Update player status
        updatePlayerStatus(socket.uid, PlayerStatus.QUEUING);

        socket.emit('lobbyJoined', { lobbyId: data.lobbyId });

        // If lobby is now full, create the game
        if (lobby.isFull()) {
            // Clear any pending challenge before starting the game
            pendingChallenges.delete(lobby.opponentId);
            
            await createGame(
                lobby.creatorSocket,
                lobby.opponentSocket,
                mode,  // Use the determined mode
                null,  // No league for friend lobbies
                lobby.stake
            );
            lobbies.delete(data.lobbyId);
        }
    } catch (error) {
        // Reset player status on error
        updatePlayerStatus(socket.uid, PlayerStatus.ONLINE);
        console.error('Error joining lobby:', error);
        socket.emit('lobbyError', { 
            message: error instanceof Error ? error.message : 'Failed to join lobby'
        });
    }
}


export async function processLeaveQueue(socket) {
    // @ts-ignore
    const uid = socket.uid;
    const status = getPlayerStatus(uid);
    
    console.log(`[matchmaker:processLeaveQueue] Player ${uid} leaving queue in status ${status}`);
    if (status === PlayerStatus.QUEUING) {
        updatePlayerStatus(uid, PlayerStatus.ONLINE);
    }

    // Check if player is in a lobby and if it's a friend lobby, notify the opponent
    const lobby = findLobbyBySocketId(socket.id);
    if (lobby && lobby.creatorSocket?.id === socket.id) {
        // Get opponent's socket if they're connected
        const opponentSocket = lobby.opponentSocket || getPlayerSocket(lobby.opponentId);
        if (opponentSocket) {
            // Get the pending challenge to access the challenger's name
            const pendingChallenge = pendingChallenges.get(lobby.opponentId);
            opponentSocket.emit('challengeCancelled', {
                challengerName: pendingChallenge?.challengerName || 'Player'
            });
        }
    }

    leaveQueueOrLobby(socket);
}
  
export async function processDisconnect(socket) {
    console.log(`Player ${socket.id} disconnected`);
    // Update player status to offline
    // @ts-ignore
    updatePlayerStatus(socket.uid, PlayerStatus.OFFLINE);
    // Check if the player is in a queue
    leaveQueueOrLobby(socket);
}

async function leaveQueueOrLobby(socket) {
    const queuePlayer = playersQueue.find(player => player.socket.id === socket.id);
    if (queuePlayer) {
        await handleQueueDisconnect(queuePlayer);
        return;
    }

    const lobby = findLobbyBySocketId(socket.id);
    if (lobby) {
        await handleLobbyDisconnect(socket, lobby);
        return;
    }
}

async function handleQueueDisconnect(player: QueuingPlayer) {
    notifyAdmin(player.socket.uid, null, player.mode, 'left');
    removePlayerFromQ(player);
    await logQueuingActivity(player.socket.uid, 'leaveQueue', null);
}

async function handleLobbyDisconnect(socket, lobby: Lobby) {
    console.log(`Player ${socket.id} disconnected from lobby ${lobby.id}`);
    
    // Destroy the lobby
    lobbies.delete(lobby.id);
    
    // Only call cancelLobby if the disconnecting player is the creator
    if (socket.uid === lobby.creatorId) {
        try {
            await cancelLobby(socket.firebaseToken, lobby.id, 'creator disconnected');
        } catch (error) {
            // Already logged in cancelLobby
        }
    }
    
    await logQueuingActivity(socket.uid, 'leaveLobby', lobby.id);
}

function findLobbyBySocketId(socketId: string): Lobby | undefined {
    return Array.from(lobbies.values()).find(lobby => 
        lobby.creatorSocket?.id === socketId || lobby.opponentSocket?.id === socketId
    );
}

interface FirebasePublicKeys {
  [key: string]: string;
}

interface FirebaseTokenHeader {
    alg: string;
    kid: string;
  }
  
interface FirebaseTokenPayload extends JwtPayload {
aud: string;
iss: string;
sub: string;
auth_time: number;
}

const FIREBASE_PUBLIC_KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

function isFirebaseTokenHeader(header: any): header is FirebaseTokenHeader {
    return typeof header === 'object' && header !== null &&
           typeof header.alg === 'string' &&
           typeof header.kid === 'string';
  }
  
  function isFirebaseTokenPayload(payload: any): payload is FirebaseTokenPayload {
    return typeof payload === 'object' && payload !== null &&
           typeof payload.exp === 'number' &&
           typeof payload.iat === 'number' &&
           typeof payload.aud === 'string' &&
           typeof payload.iss === 'string' &&
           typeof payload.sub === 'string' &&
           typeof payload.auth_time === 'number';
  }
  
  async function validateFirebaseIdToken(idToken: string, projectId: string): Promise<string> {
    // Fetch Firebase public keys
    const { data: publicKeys, headers } = await axios.get<FirebasePublicKeys>(FIREBASE_PUBLIC_KEYS_URL);
    
    // Get max-age from Cache-Control header
    const cacheControl = headers['cache-control'];
    const maxAge = parseInt(cacheControl.split('max-age=')[1]) || 3600;
  
    // Decode the token without verifying to get the header and payload
    const decodedToken = jwt.decode(idToken, { complete: true });
    // console.log(`Decoded token: ${JSON.stringify(decodedToken)}`);
  
    if (!decodedToken || typeof decodedToken !== 'object') {
      throw new Error('Invalid token format');
    }
  
    if (!isFirebaseTokenHeader(decodedToken.header)) {
      throw new Error('Invalid token header');
    }
  
    if (!isFirebaseTokenPayload(decodedToken.payload)) {
      throw new Error('Invalid token payload');
    }
  
    const { header, payload } = decodedToken;
  
    // Verify header claims
    if (header.alg !== 'RS256') {
      throw new Error(`Invalid algorithm ${header.alg}`);
    }
  
    const kid = header.kid;
    if (!publicKeys[kid]) {
      throw new Error('Invalid key ID');
    }
  
    // Verify signature and decode payload
    const publicKey = publicKeys[kid];
    try {
      jwt.verify(idToken, publicKey, { algorithms: ['RS256'] });
    } catch (error) {
      throw new Error('Invalid token signature');
    }
  
    // Verify payload claims
    const now = Math.floor(Date.now() / 1000);
  
    if (payload.exp <= now) {
      throw new Error('Token has expired');
    }
  
    if (payload.iat > now) {
      throw new Error('Invalid issued-at time');
    }
  
    if (payload.aud !== projectId) {
      throw new Error('Invalid audience');
    }
  
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
      throw new Error('Invalid issuer');
    }
  
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Invalid subject');
    }
  
    if (payload.auth_time > now) {
      throw new Error('Invalid auth time');
    }
  
    return payload.sub;
  }
  
enum PlayerStatus {
  ONLINE = 'online',
  QUEUING = 'queuing',
  INGAME = 'ingame',
  OFFLINE = 'offline',
  JOINING_GAME = 'joining_game'
}

interface ConnectedPlayer {
  socket: Socket;
  status: PlayerStatus;
  gameId?: string;
}

interface PlayerRegistry {
  [uid: string]: ConnectedPlayer;
}

const connectedPlayers: PlayerRegistry = {};

function updatePlayerStatus(uid: string, status: PlayerStatus, gameId?: string) {
  if (connectedPlayers[uid]) {
    connectedPlayers[uid].status = status;
    connectedPlayers[uid].gameId = gameId;
    console.log(`Player ${uid} status updated to ${status}${gameId ? ` (game: ${gameId})` : ''}`);
  }
}

function getPlayerSocket(uid: string): Socket | null {
  return connectedPlayers[uid]?.socket || null;
}

function getPlayerStatus(uid: string): PlayerStatus {
  return connectedPlayers[uid]?.status || PlayerStatus.OFFLINE;
}

export async function processConnection(socket) {
  try {
    const uid = await getUID(socket.firebaseToken);
    socket.uid = uid;

    // Register the player
    connectedPlayers[uid] = {
      socket,
      status: PlayerStatus.ONLINE
    };
    
    console.log(`Player ${uid} connected (total: ${Object.keys(connectedPlayers).length})`);
    // @ts-ignore
    updatePlayerStatus(socket.uid, PlayerStatus.ONLINE);
  } catch (error) {
    console.error('Error processing connection:', error);
    socket.disconnect();
  }
}

export function processLeaveGame(socket: Socket, data: { gameId: string }) {
    // @ts-ignore
    const uid = socket.uid;
    const status = getPlayerStatus(uid);
    
    console.log(`[matchmaker:processLeaveGame] Player ${uid} leaving game ${data.gameId}`);
    if (status === PlayerStatus.INGAME) {
        // Only update if they're leaving the game they're actually in
        const player = connectedPlayers[uid];
        if (player && player.gameId === data.gameId) {
            updatePlayerStatus(uid, PlayerStatus.ONLINE);
            console.log(`Player ${uid} left game ${data.gameId}`);
        }
    }
}

function getPlayerStatusInfo(uid: string) {
    const player = connectedPlayers[uid];
    if (!player) return { status: PlayerStatus.OFFLINE };
    
    return {
        status: player.status,
        gameId: player.gameId
    };
}

function getFriendsStatuses(friendIds: string[]) {
    const statuses = {};
    friendIds.forEach(friendId => {
        statuses[friendId] = getPlayerStatusInfo(friendId);
    });
    return statuses;
}

export function processGetPlayerStatus(socket: Socket, data: { playerId: string }) {
    const statusInfo = getPlayerStatusInfo(data.playerId);
    socket.emit('playerStatus', statusInfo);
}

export function processGetFriendsStatuses(socket: Socket, data: { friendIds: string[] }) {
    const statuses = getFriendsStatuses(data.friendIds);
    socket.emit('friendsStatuses', statuses);
}

export async function processSendChallenge(socket: any, data: { opponentUID: string }) {
    try {
        // Get opponent's socket if they're connected
        const opponentSocket = getPlayerSocket(data.opponentUID);
        if (!opponentSocket) {
            socket.emit('challengeResponse', { 
                error: 'Player is not currently online' 
            });
            return;
        }

        // Check if opponent is available
        const opponentStatus = getPlayerStatus(data.opponentUID);
        const allowedStatuses = [PlayerStatus.ONLINE];
        if (!allowedStatuses.includes(opponentStatus)) {
            socket.emit('challengeResponse', { 
                error: 'Player is not available for challenges right now' 
            });
            return;
        }

        // Get challenger's data
        const challengerData = await apiFetch(
            `getProfileData?playerId=${socket.uid}`,
            socket.firebaseToken
        );

        // Get opponent's data
        const opponentData = await apiFetch(
            `getProfileData?playerId=${data.opponentUID}`,
            socket.firebaseToken
        );

        // Create the friend lobby via API
        try {
            const response = await apiFetch(
                'createLobby',
                socket.firebaseToken,
                {
                    method: 'POST',
                    body: {
                        type: 'friend',
                        opponentUID: data.opponentUID
                    }
                }
            );

            // Track the pending challenge
            pendingChallenges.set(data.opponentUID, {
                challengerId: socket.uid,
                challengerName: challengerData.name,
                targetName: opponentData.name,
                lobbyId: response.lobbyId
            });

            // Notify the challenger
            socket.emit('challengeResponse', {
                lobbyId: response.lobbyId
            });

            // Notify the opponent with challenger's data
            opponentSocket.emit('challengeReceived', {
                challengerId: socket.uid,
                challengerName: challengerData.name,
                challengerAvatar: challengerData.avatar,
                lobbyId: response.lobbyId
            });

            // Update both players' status
            updatePlayerStatus(socket.uid, PlayerStatus.QUEUING);

            // Log the activity
            await logQueuingActivity(socket.uid, 'sendChallenge', data.opponentUID);

        } catch (error) {
            console.error('Error creating friend lobby:', error);
            socket.emit('challengeResponse', { 
                error: 'Failed to create challenge lobby' 
            });
        }

    } catch (error) {
        console.error('Error processing challenge:', error);
        socket.emit('challengeResponse', { 
            error: 'Internal server error while processing challenge' 
        });
    }
}

export async function processChallengeDeclined(socket, data: { 
    challengerId: string,
    lobbyId: string 
}) {
    console.log(`[matchmaker:processChallengeDeclined] Challenger ${data.challengerId} declined challenge for lobby ${data.lobbyId}`);
    
    // Get the pending challenge before removing it
    const pendingChallenge = pendingChallenges.get(socket.uid);
    // Remove the pending challenge
    pendingChallenges.delete(socket.uid);
    
    // Get challenger's socket if they're connected
    const challengerSocket = getPlayerSocket(data.challengerId);
    if (challengerSocket) {
        challengerSocket.emit('challengeDeclined', {
            playerName: pendingChallenge?.targetName || 'Player'
        });

        try {
            // @ts-ignore
            await cancelLobby(challengerSocket.firebaseToken, data.lobbyId, 'challenge declined');
        } catch (error) {
            // Already logged in cancelLobby
        }
    }

    // Update both players' status back to online
    updatePlayerStatus(socket.uid, PlayerStatus.ONLINE);
    updatePlayerStatus(data.challengerId, PlayerStatus.ONLINE);
}

async function tryJoinGame(socket: Socket): Promise<boolean> {
    // @ts-ignore
    const uid = socket.uid;
    const status = getPlayerStatus(uid);
    
    // If player is already in a game or joining one, prevent joining
    if (status === PlayerStatus.INGAME || status === PlayerStatus.JOINING_GAME) {
        socket.emit('gameError', { 
            message: 'Already in or joining another game' 
        });
        return false;
    }
    
    // Set status to joining game
    updatePlayerStatus(uid, PlayerStatus.JOINING_GAME);
    return true;
}

// Add this interface near the other interfaces
interface PendingChallenge {
    challengerId: string;
    challengerName: string;
    targetName: string;
    lobbyId: string;
}

// Add this to track pending challenges, near other global variables
const pendingChallenges: Map<string, PendingChallenge> = new Map();

// Add this helper function
function declinePendingChallenge(uid: string) {
    const pendingChallenge = pendingChallenges.get(uid);
    if (pendingChallenge) {
        const { challengerId, lobbyId } = pendingChallenge;
        
        // Get challenger's socket if they're connected
        const challengerSocket = getPlayerSocket(challengerId);
        if (challengerSocket) {
            challengerSocket.emit('challengeDeclined');
            
            // @ts-ignore
            cancelLobby(challengerSocket.firebaseToken, lobbyId, 'pending challenge declined')
                .catch(() => {}); // Error already logged in cancelLobby
        }

        // Update challenger's status back to online
        updatePlayerStatus(challengerId, PlayerStatus.ONLINE);
        
        // Remove the pending challenge
        pendingChallenges.delete(uid);
        
        console.log(`Declined pending challenge from ${challengerId} (lobby: ${lobbyId}) due to queue match`);
    }
}

// Add this helper function near other helper functions
async function cancelLobby(creatorToken: string, lobbyId: string, reason: string = '') {
    try {
        await apiFetch(
            'cancelLobby',
            creatorToken,
            {
                method: 'POST',
                body: {
                    lobbyId,
                }
            }
        );
        console.log(`Lobby ${lobbyId} cancelled successfully${reason ? ` (${reason})` : ''}`);
    } catch (error) {
        console.error(`Error cancelling lobby ${lobbyId}:`, error);
        throw error; // Re-throw to let caller handle if needed
    }
}
