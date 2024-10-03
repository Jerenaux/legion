import express from 'express';
import { Socket, Server } from "socket.io";
import { createServer } from "http";
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();
import { setupMatchmaking, processJoinQueue, processDisconnect } from './matchmaking';

const allowedOrigins = [process.env.CLIENT_ORIGIN, 'https://legion-32c6d.firebaseapp.com'];
console.log(`Allowed client origins: ${allowedOrigins}`);

const corsSettings = {
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

const app = express();
app.use(cors(corsSettings));
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: corsSettings,
});

// Basic HTTP endpoint for health checks
app.get('/', (req, res) => {
    console.log(`[server] Matchmaker check / warm up request`);
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

setupMatchmaking(io);
