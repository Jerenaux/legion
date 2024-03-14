import { Server } from "socket.io";
import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
import dotenv from 'dotenv';
dotenv.config();

import { apiFetch } from "./API";

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "http://0.0.0.0:8080",
        methods: ["GET", "POST"],
        credentials: true
      }
});

interface Player {
    socketId: string;
    elo: number;
    range: number;
    mode: 'practice' | 'casual' | 'ranked';
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
                console.log(`Match found between ${player1.socketId} and ${player2.socketId}`);
                // Start a game for these two players
                const gameId = uuidv4();
                notifyPlayers(player1, player2, gameId);
                playersQueue.splice(j, 1); // Remove player2 first since it's later in the array
                playersQueue.splice(i, 1); // Remove player1
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
    const isLeagueCompatible = player1.mode !== 'ranked' || player1.league === player2.league;
    return isEloCompatible && isLeagueCompatible;
}

function notifyPlayers(player1: Player, player2: Player, gameId: string) {
    // Here you would notify both players about their match and the game ID
    io.to(player1.socketId).emit("matchFound", { opponentId: player2.socketId, gameId });
    io.to(player2.socketId).emit("matchFound", { opponentId: player1.socketId, gameId });
}

httpServer.listen(3000, () => {
    console.log("Matchmaking server listening on port 3000");
});

io.on("connection", (socket: any) => {
    console.log(`Player connected`);
    socket.firebaseToken = socket.handshake.auth.token;

    socket.on("joinQueue", async (data: { mode: 'practice' | 'casual' | 'ranked'; }) => {
        const queuingData = await apiFetch(
            'queuingData',
            socket.firebaseToken,
        );

        const player: Player = {
            socketId: socket.id,
            elo: queuingData.elo,
            range: eloRangeStart,
            mode: data.mode,
            league: queuingData.league,
            waitingTime: 0,
        };
        playersQueue.push(player);
        console.log(`Player joined queue: ${socket.id}`);
    });

    socket.on("disconnect", () => {
        const index = playersQueue.findIndex(player => player.socketId === socket.id);
        if (index !== -1) {
            playersQueue.splice(index, 1);
        }
    });
});

setupMatchmaking();
