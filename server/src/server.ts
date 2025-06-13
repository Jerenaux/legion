// server.ts

import express from 'express';
import { Socket, Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import * as admin from "firebase-admin";
import cors from 'cors';
import { getFirestore } from 'firebase-admin/firestore';

import { apiFetch } from './API';
import { Game } from './Game';
import { AIGame } from './AIGame';
import { PvPGame } from './PvPGame';
import firebaseConfig from '@legion/shared/firebaseConfig';
import { PlayMode } from '@legion/shared/enums';
import { transformDailyLoot } from '@legion/shared/utils';
import { PlayerDataForGame } from '@legion/shared/interfaces';
import { withRetry } from './utils';

dotenv.config();

if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    // We're running locally with emulators
    admin.initializeApp({
        projectId: firebaseConfig.projectId,
    });
    
    // Connect to local emulator
    const db = getFirestore();
    db.settings({
        host: 'api:8090',
        ssl: false
    });

    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    process.env["FIRESTORE_EMULATOR_HOST"] = "api:8090"; 
} else {
    // We're running in production
    admin.initializeApp(firebaseConfig);
}

const PORT = process.env.PORT || 3123;

// Create a new express application instance
const app: express.Application = express();

const allowedOrigins = [process.env.CLIENT_ORIGIN, 'https://legion-32c6d.firebaseapp.com', 'https://play-legion.io', 'http://localhost:3000'];

const corsSettings = {
  origin: (origin, callback) => {
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.indexOf('*') !== -1) {
        // console.log("Successful connection from origin:", origin);
        callback(null, true);
      } else {
        console.log("Origin not allowed:", origin);
        callback(new Error('CORS not allowed'));
      }
  },
  methods: ["GET", "POST"],
  credentials: true
};

// Use the cors middleware
app.use(cors(corsSettings));

// Create a new http server instance
const server = createServer(app);

// Create a new socket.io instance
const io = new Server(server, {
    cors: corsSettings
  });

function shortToken(token: string) {
  // Return the first 3 and last 3 characters of the token
  if (!token) return '';
  return token.slice(0, 3) + '...' + token.slice(-4);
}

const socketMap = new Map<Socket, Game>();
const gamesMap = new Map<string, Game>();

async function getPlayerData(uid: string, retries = 10, delay = 500): Promise<PlayerDataForGame> {
  return withRetry(async () => {
    const db = admin.firestore();
    const playerDoc = await db.collection('players').doc(uid).get();
    
    if (!playerDoc.exists) {
      throw new Error('Player not found');
    }

    const playerData = playerDoc.data();
    if (!playerData) {
      throw new Error('Player data is null');
    }

    // Update last active date if needed
    const today = new Date().toISOString().replace('T', ' ').slice(0, 19);
    if (playerData.lastActiveDate !== today) {
      db.collection("players").doc(uid).update({
        lastActiveDate: today,
      });
    }

    // Transform dailyloot data
    const transformedDailyLoot = transformDailyLoot(playerData.dailyloot || {});

    const AIwinRatio = 
      playerData.AIstats && playerData.AIstats.nbGames > 0 ?
        (playerData.AIstats.wins - 1) / (playerData.AIstats.nbGames + 2) :
        0;

    return {
      uid,
      lvl: playerData.lvl || 1,
      elo: playerData.elo || 100,
      name: playerData.name || '',
      teamName: "teamName",
      avatar: playerData.avatar || '1',
      league: playerData.league || 0,
      rank: playerData.leagueStats?.rank || 0,
      dailyloot: transformedDailyLoot,
      AIwinRatio,
      completedGames: playerData.engagementStats?.completedGames || 0,
      engagementStats: playerData.engagementStats || {},
    };
  }, retries, delay, 'getPlayerData');
}

async function getGameData(gameId: string, retries = 10, delay = 500) {
  return withRetry(async () => {
    const db = admin.firestore();
    const querySnapshot = await db.collection("games")
      .where("gameId", "==", gameId.toString())
      .get();

    if (querySnapshot.empty) {
      throw new Error("Game ID not found");
    }

    return querySnapshot.docs[0].data();
  }, retries, delay, 'getGameData');
}

io.on('connection', async (socket: any) => {
    try {
      // Throw an exception if the token is not provided
      if (!socket.handshake.auth.token) {
        throw new Error('No token provided');
      }
      socket.firebaseToken = socket.handshake.auth.token.toString();
      const decodedToken = await admin.auth().verifyIdToken(socket.firebaseToken);
      socket.uid = decodedToken.uid;
      
      let gameId = socket.handshake.auth.gameId;
      const isReplay = socket.handshake.auth.isReplay;

      if (gameId == undefined) {
        console.error('No game ID provided!');
        socket.disconnect();
        return;
      }

      if (isReplay) {
        console.log(`[server:connection] User ${shortToken(socket.uid)} requesting replay of game ${gameId}`);
        const replayData = await apiFetch(
          `getReplay?id=${gameId}`,
          '',
          {
            headers: {
              'x-api-key': process.env.API_KEY,
            }
          }
        );
        
        if (!replayData) {
          console.error(`Replay ${gameId} not found!`);
          socket.disconnect();
          return;
        }

        // Send replay data immediately
        socket.emit('replayData', replayData);
        return;
      }

      console.log(`[server:connection] User ${shortToken(socket.uid)} connecting to game ${gameId}`);

      const isGame0 = gameId === '0';
      if (isGame0) gameId = socket.uid;

      const gameData = await getGameData(gameId);
  
      // Check if firebase UID is in gameData.players
      if (!gameData.players.includes(socket.uid)) {
        console.error(`Player with UID ${shortToken(socket.uid)} is not in game ${gameId}!`);
        socket.disconnect();
        return;
      } 

      let game: Game;
      if (!gamesMap.has(gameId)) {
        // console.log(`[server:connection] Creating game ${gameId} with mode ${gameData.mode}`);
        const AImodes = [PlayMode.PRACTICE, PlayMode.CASUAL_VS_AI, PlayMode.RANKED_VS_AI, PlayMode.TUTORIAL];
        const gameType = AImodes.includes(gameData.mode) ? AIGame : PvPGame;
        game = new gameType(gameId, gameData.mode, gameData.league, io);
        if (gameData.mode === PlayMode.STAKED) {
          game.setStake(gameData.stake);
        }
        gamesMap.set(gameId, game);
      }
      game = gamesMap.get(gameId)!;

      if (game.gameStarted) { // Reconnecting player
        console.log(`Reconnecting player ${shortToken(socket.uid)} to game ${gameId}`);
        game.reconnectPlayer(socket);
      } else {
        console.log(`[server:connection] Fetching player data for ${socket.uid}`);
        const playerData = await getPlayerData(socket.uid);
        game.addPlayer(socket, playerData);
      }

      socketMap.set(socket, game);
  
      socket.on('disconnect', () => {
          console.log(`[server:disconnect] User ${shortToken(socket.uid)} disconnected`);
          socketMap.get(socket)?.handleDisconnect(socket);
          socketMap.delete(socket);
      });
  
      socket.on('move', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('move', data, socket);
      });
  
      socket.on('attack', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('attack', data, socket);
      });

      socket.on('obstacleattack', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('obstacleattack', data, socket);
      });
  
      socket.on('useitem', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('useitem', data, socket);
      });
  
      socket.on('spell', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('spell', data, socket);
      });

      socket.on('abandonGame', () => {
        const game = socketMap.get(socket);
        game?.abandonGame(socket);
      });

      socket.on('teamRevealed', () => {
        const game = socketMap.get(socket);
        game?.handleTeamRevealed();
      });

      socket.on('passTurn', () => {
        const game = socketMap.get(socket);
        game?.processAction('passTurn', null, socket);
      });
    } catch (error) {
        console.error(`[server:connection] Error joining game server: ${error}`);
    }
});

// Basic HTTP endpoint for health checks
app.get('/', (req, res) => {
  console.log(`[server] Health check / warm up request`);
  res.send('Game server is running');
});

const port = process.env.PORT || 3123;
server.listen(port, () => {
    console.log(`Server is running on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Optionally perform cleanup
  process.exit(1); // Exit to allow Cloud Run to restart the container
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally perform cleanup
  process.exit(1); // Exit to allow Cloud Run to restart the container
});

const shutdown = () => {
  console.log('Received kill signal, shutting down gracefully.');
  server.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
