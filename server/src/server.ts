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
        const gameType = gameData.mode === PlayMode.PRACTICE ? AIGame : PvPGame;
        game = new gameType(io);
        gamesMap.set(gameId, game);
      }

      game.addPlayer(socket);
      socketMap.set(socket, game);
      // TODO: game start logic
  
      socket.on('disconnect', () => {
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
  
      socket.on('useitem', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('useitem', data, socket);
      });
  
      socket.on('skill', (data: any) => {
        const game = socketMap.get(socket);
        game?.processAction('skill', data, socket);
      });
    } catch (error) {
        console.error(`Error joining game server: ${error}`);
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
