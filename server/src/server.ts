import express from 'express';
import { Socket, Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
import * as admin from "firebase-admin";

import {apiFetch} from './API';
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

// Create a new http server instance
const server = createServer(app);

// Create a new socket.io instance
const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://0.0.0.0:8080",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

function shortToken(token: string) {
  // Return the first 3 and last 3 characters of the token
  if (!token) return '';
  return token.slice(0, 3) + '...' + token.slice(-4);
}

const socketMap = new Map<Socket, Game>();
const gamesMap = new Map<string, Game>();

io.on('connection', async (socket: any) => {
    // console.log(`Connected user ${socket.handshake.auth.token}`);
    try {
      socket.firebaseToken = socket.handshake.auth.token.toString();
      const decodedToken = await admin.auth().verifyIdToken(socket.firebaseToken);
      socket.uid = decodedToken.uid;
      
      const gameId = socket.handshake.auth.gameId;
      if (!gameId) {
        console.log('No game ID provided!');
        socket.disconnect();
        return;
      }
      console.log(`[server:connection] User ${shortToken(socket.uid)} connecting to game ${gameId}`);

      const gameData = await apiFetch(
        `gameData?id=${gameId}`,
        '', // TODO: add API key
      );
  
      // Check if firebase UID is in gameData.players
      if (!gameData.players.includes(socket.uid)) {
        console.log(`Player with UID ${shortToken(socket.uid)} is not in game ${gameId}!`);
        socket.disconnect();
        return;
      } 

      let game: Game;
      if (!gamesMap.has(gameId)) {
        console.log(`[server:connection] Creating game ${gameId}`);
        const gameType = gameData.mode === PlayMode.PRACTICE || gameData.mode == PlayMode.CASUAL_VS_AI ? AIGame : PvPGame;
        game = new gameType(gameId, gameData.mode, gameData.league, io);
        gamesMap.set(gameId, game);
      }
      game = gamesMap.get(gameId)!;

      if (game.gameStarted) { // Reconnecting player
        console.log(`Reconnecting player ${shortToken(socket.uid)} to game ${gameId}`);
        game.reconnectPlayer(socket);
      } else {
        const playerData = await apiFetch(
          `getPlayerData?id=${gameId}`,
          socket.firebaseToken,
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
        console.log(`Moving in game ${game?.id}`);
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
    } catch (error) {
        console.error(`Error joining game server: ${error}`);
    }
});

const port = process.env.PORT || 3123;
server.listen(port, () => {
    console.log(`Server is running on port ${PORT}`);
});
