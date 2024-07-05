import { Socket, Server } from "socket.io";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
import dotenv from 'dotenv';
import * as admin from "firebase-admin";
import {
    Client,
    GatewayIntentBits,
  } from 'discord.js';

import { apiFetch } from "./API";
import { PlayMode, League } from '@legion/shared/enums';
import firebaseConfig from '@legion/shared/firebaseConfig';

dotenv.config();
const discordClient = new Client({intents: [GatewayIntentBits.Guilds]});
discordClient.login(process.env.DISCORD_TOKEN);

admin.initializeApp(firebaseConfig);
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "http://0.0.0.0:8080",
        methods: ["GET", "POST"],
        credentials: true
      }
});

interface Player {
    socket: any,
    elo: number;
    range: number;
    mode: number;
    league?: League;
    waitingTime: number;
    gold: number;
}

const playersQueue: Player[] = [];
const eloRangeIncreaseInterval = 20; // seconds
const eloRangeStart = 50;
const eloRangeStep = 50; // Increase range by 50 points every interval
const goldRewardInterval = 15;
const goldReward = 1;
const casualModeThresholdTime = 60; // seconds after which redirection probability starts increasing
const maxWaitTimeForPractice = 300; // maximum wait time after which a player is guaranteed to be redirected

async function notifyAdmin(mode: PlayMode) {
    try {
        const adminUser = await discordClient.users.fetch('272906141728505867');
        adminUser.send(`A player has joined the queue in ${PlayMode[mode]} mode!`);
    } catch (error) {
        console.error('Failed to send DM:', error);
    }
}

// Initialize matchmaking functionality
function setupMatchmaking() {
    setInterval(() => {
        increaseEloRange();
        tryMatchPlayers();
    }, 1000);
}

function incrementGoldReward(player) {
    if (player.mode != PlayMode.PRACTICE && player.waitingTime % goldRewardInterval === 0) {
        player.gold += goldReward; 
        player.socket.emit("updateGold", { gold: player.gold });
    }
}

function increaseEloRange() {
    playersQueue.forEach(player => {
        player.waitingTime += 1;

        incrementGoldReward(player);

        if (player.waitingTime >= eloRangeIncreaseInterval) {
            player.waitingTime = 0;
            player.range += eloRangeStep;
        }
    });
}

function switcherooCheck(player, i) {
    if (player.mode == PlayMode.CASUAL && player.waitingTime > casualModeThresholdTime) {
        // Calculate the probability of redirecting to a PRACTICE game
        const waitTimeBeyondThreshold = player.waitingTime - casualModeThresholdTime;
        const redirectionProbability = Math.min(1, waitTimeBeyondThreshold / (maxWaitTimeForPractice - casualModeThresholdTime));

        if (Math.random() < redirectionProbability) {
            console.log(`Redirecting ${player.socket.id} to a PRACTICE game due to long wait.`);
            createGame(player.socket, null, PlayMode.PRACTICE, null);
            savePlayerGold(player);
            playersQueue.splice(i, 1); // Remove player from the queue
            return true;
        }
    }
    return false;
}

function tryMatchPlayers() {
    let i = 0;
    while (i < playersQueue.length) {
        let player1 = playersQueue[i];
        let matchFound = false;

        if (switcherooCheck(player1, i)) return;

        for (let j = i + 1; j < playersQueue.length; j++) {
            let player2 = playersQueue[j];
            if (player1.mode === player2.mode && canBeMatched(player1, player2)) {
                console.log(`Match found between ${player1.socket.id} and ${player2.socket.id}`);
                // Start a game for these two players
                const success = createGame(player1.socket, player2.socket, player1.mode, player1.league);
                if (success) {
                    savePlayerGold(player1); 
                    savePlayerGold(player2);
                    playersQueue.splice(j, 1); // Remove player2 first since it's later in the array
                    playersQueue.splice(i, 1); // Remove player1
                }
                matchFound = true;
                break;
            }
        }

        if (!matchFound) {
            i++;
        }
    }
}

function canBeMatched(player1: Player, player2: Player): boolean {
    const isEloCompatible = Math.abs(player1.elo - player2.elo) <= player1.range && Math.abs(player1.elo - player2.elo) <= player2.range;
    const isLeagueCompatible = player1.mode !== PlayMode.RANKED || player1.league === player2.league;
    return isEloCompatible && isLeagueCompatible;
}

async function createGame(player1: Socket, player2?: Socket, mode: PlayMode = PlayMode.PRACTICE, league: League | null = null) {
    try {
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
                }
            }
        );
        io.to(player1.id).emit("matchFound", { gameId });
        if (player2)
            io.to(player2.id).emit("matchFound", { gameId });
        return true;
    } catch (error) {
        console.error(`Error creating game: ${error}`);
        return false;
    }
}

httpServer.listen(3000, () => {
    console.log("Matchmaking server listening on port 3000");
});


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

io.on("connection", (socket: any) => {
    console.log(`Player connected`);
    socket.firebaseToken = socket.handshake.auth.token;

    socket.on("joinQueue", async (data: { mode: PlayMode }) => {

        const decodedToken = await admin.auth().verifyIdToken(socket.firebaseToken);
        socket.uid = decodedToken.uid;

        if (data.mode == PlayMode.PRACTICE) {
            createGame(socket, null, PlayMode.PRACTICE);
            return;
        }

        notifyAdmin(data.mode);
        addToQueue(socket, data.mode);
        logQueuingActivity(socket.uid, 'joinQueue', data.mode);
    });

    socket.on("disconnect", async () => {
        console.log(`Player disconnected`);
        const index = playersQueue.findIndex(player => player.socket.id === socket.id);
        if (index !== -1) {
            await savePlayerGold(playersQueue[index]); 
            playersQueue.splice(index, 1);
            logQueuingActivity(socket.uid, 'leaveQueue', null);
        }
    });
});

setupMatchmaking();
