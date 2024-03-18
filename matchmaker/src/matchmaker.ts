import { Socket, Server } from "socket.io";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
import dotenv from 'dotenv';
import * as admin from "firebase-admin";

import { apiFetch } from "./API";
import { PlayMode } from '@legion/shared/enums';
import firebaseConfig from '@legion/shared/firebaseConfig';

dotenv.config();

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
    league?: string;
    waitingTime: number;
}

const playersQueue: Player[] = [];
const eloRangeIncreaseInterval = 20; // seconds
const eloRangeStart = 50;
const eloRangeStep = 50; // Increase range by 50 points every interval

// Initialize matchmaking functionality
function setupMatchmaking() {
    setInterval(() => {
        increaseEloRange();
        tryMatchPlayers();
    }, 1000);
}

function increaseEloRange() {
    playersQueue.forEach(player => {
        player.waitingTime += 1;
        if (player.waitingTime >= eloRangeIncreaseInterval) {
            player.waitingTime = 0;
            player.range += eloRangeStep;
        }
    });
}

function tryMatchPlayers() {
    let i = 0;
    while (i < playersQueue.length) {
        let player1 = playersQueue[i];
        let matchFound = false;

        for (let j = i + 1; j < playersQueue.length; j++) {
            let player2 = playersQueue[j];
            if (player1.mode === player2.mode && canBeMatched(player1, player2)) {
                console.log(`Match found between ${player1.socket.id} and ${player2.socket.id}`);
                // Start a game for these two players
                const success = createGame(player1.socket, player2.socket, player1.mode);
                if (success) {
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

async function createGame(player1: Socket, player2?: Socket, mode: PlayMode = PlayMode.RANKED) {
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
    const queuingData = await apiFetch(
        'queuingData',
        socket.firebaseToken,
    );

    const player: Player = {
        socket,
        elo: queuingData.elo,
        range: eloRangeStart,
        mode,
        league: queuingData.league,
        waitingTime: 0,
    };
    playersQueue.push(player);
    console.log(`Player ${socket.id} joined queue  in mode ${mode} with elo ${player.elo} and league ${player.league}`);
}

io.on("connection", (socket: any) => {
    console.log(`Player connected`);
    const firebaseToken = socket.handshake.auth.token;

    socket.on("joinQueue", async (data: { mode: PlayMode }) => {

        const decodedToken = await admin.auth().verifyIdToken(firebaseToken);
        socket.uid = decodedToken.uid;

        if (data.mode == PlayMode.PRACTICE) {
            createGame(socket, null, PlayMode.PRACTICE);
            return;
        }

        addToQueue(socket, data.mode);
    });

    socket.on("disconnect", () => {
        const index = playersQueue.findIndex(player => player.socket.id === socket.id);
        if (index !== -1) {
            playersQueue.splice(index, 1);
        }
    });
});

setupMatchmaking();
