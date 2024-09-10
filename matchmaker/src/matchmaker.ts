import express from 'express';
import { Server } from "socket.io";
import { createServer } from "http";
import dotenv from 'dotenv';

dotenv.config();
import { setupMatchmaking, processJoinQueue, processDisconnect } from './matchmaking';

const allowedOrigins = [process.env.CLIENT_ORIGIN];
console.log(`Allowed client origins: ${allowedOrigins}`);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            
            if (!origin || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.indexOf('*') !== -1) {
              console.log("Successful connection from origin:", origin);
              callback(null, true);
            } else {
              console.log("Origin not allowed:", origin);
              callback(new Error('CORS not allowed'));
            }
        },
        methods: ["GET", "POST"],
        credentials: true
      }
});

// Basic HTTP endpoint for health checks
app.get('/', (req, res) => {
    res.send('Matchmaking server is running');
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
