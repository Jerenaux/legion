// server.ts

import express from 'express';
import { Socket, Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import * as admin from "firebase-admin";
import { v4 as uuidv4 } from "uuid";
import cors from 'cors';

import { apiFetch } from './API';
import { Game } from './Game';
import { AIGame } from './AIGame';
import { PvPGame } from './PvPGame';
import firebaseConfig from '@legion/shared/firebaseConfig';
import { PlayMode } from '@legion/shared/enums';

dotenv.config();

admin.initializeApp(firebaseConfig);
if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = process.env.FIREBASE_AUTH_EMULATOR_HOST;
}

const PORT = process.env.PORT || 3123;

// Create a new express application instance
const app: express.Application = express();

const corsSettings = {
  origin: process.env.CLIENT_ORIGIN || "http://localhost:8080", // Adjust as needed
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
      if (!gameId) {
        console.error('No game ID provided!');
        socket.disconnect();
        return;
      }
      const isTutorial = gameId === 'tutorial';
      console.log(`[server:connection] User ${shortToken(socket.uid)} connecting to game ${gameId}, [isTutorial: ${isTutorial}]`);

      let gameData;
      if (isTutorial) {
        gameId = uuidv4();

        gameData = {
          players: [socket.uid],
          mode: PlayMode.TUTORIAL,
          league: 0,
        };
      } else {
        gameData = await apiFetch(
          `gameData?id=${gameId}`,
          '', // TODO: add API key
        );
      }
  
      // Check if firebase UID is in gameData.players
      if (!gameData.players.includes(socket.uid)) {
        console.error(`Player with UID ${shortToken(socket.uid)} is not in game ${gameId}!`);
        socket.disconnect();
        return;
      } 

      let game: Game;
      if (!gamesMap.has(gameId)) {
        console.log(`[server:connection] Creating game ${gameId} with mode ${gameData.mode}`);
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
        const playerData = await apiFetch(
          `getPlayerData`,
          socket.firebaseToken,
          {},
          6,
          500,
        );
  
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

      socket.on('endTutorial', () => {
        console.log(`[server:endTutorial] User ${shortToken(socket.uid)} ending tutorial`);
        const game = socketMap.get(socket);
        if(game instanceof AIGame) {
          game.endTutorial();
        }
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
