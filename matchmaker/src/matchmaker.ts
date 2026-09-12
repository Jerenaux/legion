import './instrument';
import express from 'express';
import { Server } from "socket.io";
import { createServer } from "http";
import cors from 'cors';

import { setupMatchmaking, processJoinQueue, processJoinLobby, processDisconnect, processConnection, processLeaveQueue, processLeaveGame, processGetPlayerStatus, processGetFriendsStatuses, processSendChallenge, processChallengeDeclined, MatchmakingSocket } from './matchmaking';
import {getAuth} from 'firebase-admin/auth';
import {authenticateSocket} from '@legion/shared/socketAuth';
import {desktopCors, rejectSocketOrigin, rejectUntrustedOrigin} from '@legion/shared/corsPolicy';

const app = express();
app.use(rejectUntrustedOrigin, cors(desktopCors));
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: desktopCors,
});
io.engine.use(rejectSocketOrigin);

// Basic HTTP endpoint for health checks
app.get('/', (_req, res) => {
    console.log(`[server] Matchmaker check / warm up request`);
    res.send('Matchmaking server is running');
});

const port = process.env.PORT || 3000;
httpServer.listen(port, () => {
    console.log(`Matchmaking server listening on port ${port}`);
});


io.use(async (socket, next) => {
    try {
        await authenticateSocket(socket, token => getAuth().verifyIdToken(token));
        next();
    } catch (_error) {
        console.warn('Rejected unauthenticated matchmaker socket');
        next(new Error('Authentication failed'));
    }
});

io.on("connection", (socket) => {
    const matchmakingSocket = socket as MatchmakingSocket;
    console.log(`Socket connected`);
    processConnection(matchmakingSocket);

    socket.on("joinQueue", (data) => processJoinQueue(matchmakingSocket, data));
    socket.on("joinLobby", (data) => processJoinLobby(matchmakingSocket, data));
    socket.on("leaveQueue", () => processLeaveQueue(matchmakingSocket));
    socket.on("leaveGame", (data) => processLeaveGame(matchmakingSocket, data));
    socket.on("disconnect", () => processDisconnect(matchmakingSocket));
    socket.on("getPlayerStatus", (data) => processGetPlayerStatus(matchmakingSocket, data));
    socket.on("getFriendsStatuses", (data) => processGetFriendsStatuses(matchmakingSocket, data));
    socket.on("sendChallenge", (data) => processSendChallenge(matchmakingSocket, data));
    socket.on("challengeDeclined", (data) => processChallengeDeclined(matchmakingSocket, data));
});

setupMatchmaking(io);
