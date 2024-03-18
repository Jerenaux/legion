import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";

export const createGame = onRequest((request, response) => {
  logger.info("Creating game");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const gameId = request.body.gameId;
      const players = request.body.players;
      const mode = request.body.mode;

      const gameData = {
        date: new Date(),
        gameId,
        players,
        mode,
      };

      await db.collection("games").add(gameData);
      response.status(200).send({status: 0});
    } catch (error) {
      console.error("createGame error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const gameData = onRequest((request, response) => {
  logger.info("Fetching gameData");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const gameId = request.query.id;
      if (!gameId) {
        response.status(400).send("Bad Request: Missing game ID");
        return;
      }
      const querySnapshot = await db.collection("games")
        .where("gameId", "==", gameId.toString()).get();

      if (!querySnapshot.empty) {
        const docData = querySnapshot.docs[0].data();
        response.send(docData);
      } else {
        response.status(404).send("Game ID not found");
      }
    } catch (error) {
      console.error("gameData error:", error);
      response.status(500).send("Error fetching game data");
    }
  });
});
