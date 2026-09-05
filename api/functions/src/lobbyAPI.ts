import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, { corsMiddleware, getUID, performLockedOperation } from "./APIsetup";

const db = admin.firestore();

export const createLobby = onRequest({ memory: "512MiB" }, (request, response) =>
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const opponentUID = request.body.opponentUID as string;
      if (request.body.type !== "friend" || !opponentUID || opponentUID === uid) {
        response.status(400).send("A different opponent is required");
        return;
      }

      const result = await performLockedOperation(uid, () =>
        db.runTransaction(async (transaction) => {
          const [playerDoc, opponentDoc] = await Promise.all([
            transaction.get(db.collection("players").doc(uid)),
            transaction.get(db.collection("players").doc(opponentUID)),
          ]);
          if (!playerDoc.exists || !opponentDoc.exists) throw new Error("Player not found");
          const player = playerDoc.data()!;
          const opponent = opponentDoc.data()!;
          const lobby = db.collection("lobbies").doc();
          transaction.create(lobby, {
            creatorUID: uid,
            opponentUID,
            avatar: player.avatar,
            nickname: player.name,
            opponentNickname: opponent.name,
            elo: player.elo,
            league: player.league,
            rank: player.leagueStats?.rank || 0,
            type: "friend",
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          return { lobbyId: lobby.id };
        }),
      );
      response.status(200).send(result);
    } catch (error) {
      logger.error("createLobby error:", error);
      response.status(500).send("Error creating lobby");
    }
  }),
);

export const cancelLobby = onRequest({ memory: "512MiB" }, (request, response) =>
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const lobby = db.collection("lobbies").doc(request.body.lobbyId);
      await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(lobby);
        const data = snapshot.data();
        if (!snapshot.exists) throw new Error("Lobby not found");
        if (data?.creatorUID !== uid) throw new Error("Only the creator can cancel the lobby");
        if (data?.status !== "pending") throw new Error("Lobby is no longer pending");
        transaction.update(lobby, { status: "cancelled" });
      });
      response.status(200).send({ status: "cancelled" });
    } catch (error) {
      logger.error("cancelLobby error:", error);
      response.status(400).send("Unable to cancel lobby");
    }
  }),
);

export const getLobbyDetails = onRequest({ memory: "512MiB" }, (request, response) =>
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const lobbyId = request.query.lobbyId as string;
      if (!lobbyId) {
        response.status(400).send("Lobby ID is required");
        return;
      }
      const snapshot = await db.collection("lobbies").doc(lobbyId).get();
      const data = snapshot.data();
      if (!snapshot.exists || !data) {
        response.status(404).send("Lobby not found");
        return;
      }
      if (uid !== data.creatorUID && uid !== data.opponentUID) {
        response.status(403).send("Unauthorized to view this lobby");
        return;
      }
      response.status(200).send({
        id: snapshot.id,
        creatorId: data.creatorUID,
        opponentId: data.opponentUID,
        opponentName: data.opponentNickname,
        status: data.status,
        type: data.type,
      });
    } catch (error) {
      logger.error("getLobbyDetails error:", error);
      response.status(500).send("Error fetching lobby details");
    }
  }),
);
