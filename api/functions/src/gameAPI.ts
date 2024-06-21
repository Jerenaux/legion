import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware} from "./APIsetup";
import {EndGameData} from "@legion/shared/interfaces";
import {GameStatus} from "@legion/shared/enums";

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
        status: GameStatus.ONGOING,
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


export const completeGame = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const gameId = request.body.gameId;
      const winnerUID = request.body.winnerUID;
      const results: EndGameData = request.body.results;

      const gameRef = await db.collection("games").where("gameId", "==", gameId).limit(1).get();
      if (gameRef.empty) {
        throw new Error("Invalid game ID");
      }

      const gameDoc = gameRef.docs[0];
      const gameData = gameDoc.data();
      if (!gameData) {
        throw new Error("gameData is null");
      }

      const newGameData = {
        status: GameStatus.COMPLETED,
        winner: winnerUID,
        results,
        end: new Date(),
      };

      await gameDoc.ref.update(newGameData);
      response.status(200).send({status: 0});
    } catch (error) {
      console.error("saveGameResult error:", error);
      response.status(500).send("Error");
    }
  });
});

