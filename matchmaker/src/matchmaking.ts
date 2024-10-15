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

interface Player {
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
    opponentId: string;
    creatorSocket: Socket;
    opponentSocket: Socket;
    mode: PlayMode;
    league: League | null;
    stake: number;
    constructor(id: string, creatorId: string, opponentId: string, mode: PlayMode, league: League | null = null, stake: number = 0) {
        this.id = id;
        this.creatorId = creatorId;
        this.opponentId = opponentId;
        this.creatorSocket = null;
        this.opponentSocket = null;
        this.mode = mode;
        this.league = league;
        this.stake = stake;
    }

    addPlayer(socket: any): boolean {
        if (this.creatorSocket == null && socket.uid === this.creatorId) {
            this.creatorSocket = socket;
            return true;
        }
        if (this.opponentSocket == null && socket.uid === this.opponentId) {
            this.opponentSocket = socket;
            return true;
        }
        return false;
    }

    isFull(): boolean {
        console.log(`[matchmaker:Lobby:isFull] creatorSocket: ${this.creatorSocket}, opponentSocket: ${this.opponentSocket}`);
        return this.creatorSocket != null && this.opponentSocket != null;
    }
}

let io: Server;
const lobbies: Map<string, Lobby> = new Map();

const playersQueue: Player[] = [];
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

function removePlayerFromQ(player: Player) {
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

function incrementGoldReward(player: Player) {
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

function switcherooCheck(player: Player) {
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
                    removePlayerFromQ(player2.socket); // Remove player2 first since it's later in the array
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

function canBeMatched(player1: Player, player2: Player): boolean {
    const isDifferentPlayers = player1.socket.uid !== player2.socket.uid;
    const isEloCompatible = Math.abs(player1.elo - player2.elo) <= player1.range && Math.abs(player1.elo - player2.elo) <= player2.range;
    const isLeagueCompatible = player1.mode != PlayMode.RANKED || player1.league == player2.league;
    return isDifferentPlayers && isEloCompatible && isLeagueCompatible;
}

async function createGame(
    player1: Socket, player2?: Socket, mode: PlayMode = PlayMode.PRACTICE, league: League | null = null, stake: number = 0
) {
    try {
        // @ts-ignore
        notifyAdmin(player1?.uid, player2?.uid, mode, 'matched');
        const gameId = uuidv4();
        await apiFetch(
            'createGame',
            '', // TODO: add API key
            {
                method: 'POST',
                body: {
                    gameId,
                    // @ts-ignore
                    players: [player1.uid, player2?.uid],
                    mode,
                    league,
                    stake,
                }
            }
        );
        player1.nsp.to(player1.id).emit("matchFound", { gameId });
        if (player2)
            player2.nsp.to(player2.id).emit("matchFound", { gameId });
        return true;
    } catch (error) {
        console.error(`Error creating game: ${error}`);
        return false;
    }
}

function sendQData(player: Player) {
    player.socket.emit("queueData", {
        goldRewardInterval,
        goldReward,
        estimatedWaitingTime: 10,
        nbInQueue: countQueuingPlayers(player.mode, player.league),
        news: [
            {
                title: "Legion Play Guide released!",
                date: "2024-09-13",
                text: "Check out our new guide to learn how to play Legion like a pro!",
                link: "https://guide.play-legion.io"
            },
        ]
    });
}

async function addToQueue(socket: any, mode: PlayMode) {
    try {
        const queuingData = await apiFetch(
            'queuingData',
            socket.firebaseToken,
        );
    
        const player: Player = {
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
        console.log(`Player ${socket.id} joined queue  in mode ${mode} with elo ${player.elo} and league ${player.league}`);
    } catch (error) {
        console.error(`Error adding player to queue: ${error}`);
    }
}

async function savePlayerGold(player: Player) {
    if (player.gold == 0) return;
    try {
        await apiFetch(
            'saveGoldReward',
            '', // TODO: Add API key or player identification
            {
                method: 'POST',
                body: {
                    uid: player.socket.uid, 
                    gold: player.gold,
                },
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
            '', // TODO: Add API key or player identification
            {
                method: 'POST',
                body: {
                    playerId,
                    actionType,
                    details,
                },
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
        socket.uid = await getUID(socket.firebaseToken);

        notifyAdmin(socket.uid, null, data.mode, 'joined');

        if (data.mode == PlayMode.PRACTICE) {
            createGame(socket, null, PlayMode.PRACTICE);
            return;
        }

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
        socket.uid = await getUID(socket.firebaseToken);
        console.log(`[matchmaker:processJoinLobby] Player ${socket.uid} attempting to join lobby ${data.lobbyId} ...`);

        let lobby = lobbies.get(data.lobbyId);
        
        if (!lobby) {
            console.log(`[matchmaker:processJoinLobby] Lobby ${data.lobbyId} not found, fetching details...`);
            // Fetch lobby details if it doesn't exist
            const lobbyDetails = await apiFetch(
                `getLobbyDetails?lobbyId=${data.lobbyId}`,
                socket.firebaseToken,
            );

            lobby = new Lobby(
                data.lobbyId,
                lobbyDetails.creatorId,
                lobbyDetails.opponentId,
                lobbyDetails.mode,
                lobbyDetails.league,
                lobbyDetails.stake
            );
            lobbies.set(data.lobbyId, lobby);
        }

        if (lobby.addPlayer(socket)) {
            notifyAdmin(socket.uid, null, lobby.mode, 'joined');
            logQueuingActivity(socket.uid, 'joinLobby', PlayMode.STAKED);
            console.log(`[matchmaker:processJoinLobby] Player ${socket.uid} joined lobby ${data.lobbyId}`);


            if (lobby.isFull()) {
                await createGame(
                    lobby.creatorSocket,
                    lobby.opponentSocket,
                    lobby.mode,
                    lobby.league,
                    lobby.stake
                );
                lobbies.delete(data.lobbyId);
            }
        } else {
            socket.emit('lobbyError', { message: 'Unable to join lobby. It might be full or you are not authorized.' });
        }
    } catch (error) {
        if (error.code === 'auth/id-token-revoked') {
            console.log('The Firebase ID token has been revoked.');
            socket.emit('authError', { message: 'Your session has expired. Please log in again.' });
        } else {
            console.error('Error processing join lobby:', error);
            socket.emit('lobbyError', { message: 'Failed to join lobby. Please try again.' });
        }
    }
}

export async function processDisconnect(socket) {
    console.log(`Player ${socket.id} disconnected`);
    const player = playersQueue.find(player => player.socket.id === socket.id);
    if (!player) return;
    notifyAdmin(socket.uid, null, player.mode, 'left');
    removePlayerFromQ(player);
    logQueuingActivity(socket.uid, 'leaveQueue', null);
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
  