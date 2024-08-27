import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from 'dotenv';

import { setupMatchmaking, processJoinQueue, processDisconnect } from './matchmaking';

dotenv.config();

const httpServer = createServer();
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT_ORIGIN || "http://0.0.0.0:8080",
        methods: ["GET", "POST"],
        credentials: true
      }
});

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`Matchmaking server listening on port ${port}`);
});


io.on("connection", (socket: any) => {
    console.log(`Player connected`);
    socket.firebaseToken = socket.handshake.auth.token;

    socket.on("joinQueue", (data) => processJoinQueue(socket, data));
    socket.on("disconnect", () => processDisconnect(socket));
});

setupMatchmaking();
