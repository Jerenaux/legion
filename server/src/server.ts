import express from 'express';
import { Socket, Server } from 'socket.io';
import { createServer } from 'http';
import dotenv from 'dotenv';
dotenv.config();


import { Game } from './Game';
import { AIGame } from './AIGame';

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

// const games = [];
// function getOrCreateGame() {
//   if (games.length === 0) {
//     const game = new Game();
//     games.push(game);
//     return game;
//   } else {
//     return games[0];
//   }
// }

const socketMap = new Map<Socket, Game>();

io.on('connection', (socket: any) => {
    // console.log(`Connected user ${socket.handshake.auth.token}`);
    socket.firebaseToken = socket.handshake.auth.token;

    const game = new AIGame(io, [socket]);
    socketMap.set(socket, game);

    game.start();

    socket.on('disconnect', () => {
        console.log('A user disconnected');
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
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
