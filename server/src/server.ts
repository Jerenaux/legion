import express from 'express';
import { Socket, Server } from 'socket.io';
import { createServer } from 'http';

import { Game } from './Game';

const PORT = process.env.PORT || 3123;

// Create a new express application instance
const app: express.Application = express();

// Create a new http server instance
const server = createServer(app);

// Create a new socket.io instance
const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000", // replace with the origin of your client
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
    console.log('A user connected');

    const game = new Game(io, [socket]);
    socketMap.set(socket, game);

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });

    socket.on('move', (data: any) => {
      const game = socketMap.get(socket);
      game?.processMove(data);
    });

    socket.on('attack', (data: any) => {
      const game = socketMap.get(socket);
      game?.processAttack(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
