import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, { corsMiddleware, getUID } from "./APIsetup";
import { Token } from "@legion/shared/enums";

const db = admin.firestore();

export const createLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const stake = Number(request.body.stake);
            console.log(`[createLobby] uid: ${uid}, stake: ${stake}`);

            // Fetch player data
            const playerDoc = await db.collection("players").doc(uid).get();
            if (!playerDoc.exists) {
                return response.status(404).send("Player not found");
            }
            const playerData = playerDoc.data();

            if (!playerData) {
                return response.status(404).send("Player data not found");
            }

            // Check if player has enough balance
            if (playerData.tokens.SOL < stake) {
                return response.status(400).send("Insufficient balance");
            }

            // Create lobby document
            const lobbyData = {
                creatorUID: uid,
                avatar: playerData.avatar,
                nickname: playerData.name,
                elo: playerData.elo,
                league: playerData.league,
                rank: playerData.leagueStats.rank,
                stake: stake,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                status: "open",
            };

            const lobbyRef = await db.collection("lobbies").add(lobbyData);

            // Deduct stake from player's balance
            await playerDoc.ref.update({
                [`tokens.${Token.SOL}`]: admin.firestore.FieldValue.increment(-stake),
            });

            return response.status(200).send({ lobbyId: lobbyRef.id });
        } catch (error) {
            logger.error("createLobby error:", error);
            return response.status(500).send("Error creating lobby");
        }
    });
});

export const joinLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const lobbyId = request.body.lobbyId;

            const lobbyDoc = await db.collection("lobbies").doc(lobbyId).get();
            if (!lobbyDoc.exists) {
                return response.status(404).send("Lobby not found");
            }

            const lobbyData = lobbyDoc.data();

            if (!lobbyData) {
                return response.status(404).send("Lobby data not found");
            }

            if (lobbyData.opponentUID) {
                return response.status(400).send("Lobby is full");
            }

            if (lobbyData.creatorUID === uid) {
                return response.status(400).send("Cannot join own lobby");
            }

            if (lobbyData.status !== "open") {
                return response.status(400).send("Lobby is not open");
            }

            const playerDoc = await db.collection("players").doc(uid).get();
            if (!playerDoc.exists) {
                return response.status(404).send("Player not found");
            }
            const playerData = playerDoc.data();

            if (!playerData) {
                return response.status(404).send("Player data not found");
            }

            if (playerData.tokens.SOL < lobbyData.stake) {
                return response.status(400).send("Insufficient balance");
            }

            // Update lobby
            await lobbyDoc.ref.update({
                opponentUID: uid,
                status: "joined",
            });

            // Deduct stake from player's balance
            await playerDoc.ref.update({
                "tokens.SOL": admin.firestore.FieldValue.increment(-lobbyData.stake),
            });

            return response.status(200).send({ status: "joined" });
        } catch (error) {
            logger.error("joinLobby error:", error);
            return response.status(500).send("Error joining lobby");
        }
    });
});

export const cancelLobby = onRequest((request, response) => {
    return corsMiddleware(request, response, async () => {
        try {
            const uid = await getUID(request);
            const lobbyId = request.body.lobbyId;

            const lobbyDoc = await db.collection("lobbies").doc(lobbyId).get();
            if (!lobbyDoc.exists) {
                return response.status(404).send("Lobby not found");
            }

            const lobbyData = lobbyDoc.data();

            if (!lobbyData) {
                return response.status(404).send("Lobby data not found");
            }

            if (lobbyData.creatorUID !== uid) {
                return response.status(403).send("Only the creator can cancel the lobby");
            }

            // Update lobby status
            await lobbyDoc.ref.update({
                status: "cancelled",
            });

            // Refund stake to creator
            await db.collection("players").doc(uid).update({
                "tokens.SOL": admin.firestore.FieldValue.increment(lobbyData.stake),
            });

            return response.status(200).send({ status: "cancelled" });
        } catch (error) {
            logger.error("cancelLobby error:", error);
            return response.status(500).send("Error cancelling lobby");
        }
    });
});

export const listLobbies = onRequest((request, response) => {
    corsMiddleware(request, response, async () => {
        try {
            const lobbiesSnapshot = await db.collection("lobbies")
                .where("status", "==", "open")
                .get();

            const lobbies = lobbiesSnapshot.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    avatar: data.avatar,
                    nickname: data.nickname,
                    elo: data.elo,
                    league: data.league,
                    rank: data.rank,
                    stake: data.stake,
                };
            });

            response.status(200).send(lobbies);
        } catch (error) {
            logger.error("listLobbies error:", error);
            response.status(500).send("Error listing lobbies");
        }
    });
});
