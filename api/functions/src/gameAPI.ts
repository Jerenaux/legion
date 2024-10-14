import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, checkAPIKey} from "./APIsetup";
import {EndGameData} from "@legion/shared/interfaces";
import {GameStatus} from "@legion/shared/enums";
import {logPlayerAction} from "./dashboardAPI";


export const createGame = onRequest({ secrets: ["API_KEY"] }, (request, response) => {
  logger.info("Creating game");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      // if (!checkAPIKey(request)) {
      //   response.status(401).send('Unauthorized');
      //   return;
      // }
      const gameId = request.body.gameId;
      const players = request.body.players;
      const mode = request.body.mode;
      const league = request.body.league;

      const gameData = {
        date: new Date(),
        gameId,
        players,
        mode,
        league,
        status: GameStatus.ONGOING,
      };

      await db.collection("games").add(gameData);

      for (const player of players) {
        logPlayerAction(player, "gameStart", {
          gameId,
          league: gameData.league,
          mode: gameData.mode,
        });
      }

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
      const winnerUID = request.body.winnerUID || -1; // -1 for AI
      const rawResults: EndGameData = request.body.results;
      console.log(`[completeGame] Game ${gameId} completed, results: ${JSON.stringify(rawResults)}`);
      // Filter out the results object to remove keys that are empty strings
      const results = Object.fromEntries(
        Object.entries(rawResults).filter(([key]) => key !== '')
      );
      console.log(`[completeGame] Filtered results: ${JSON.stringify(results)}`);

      const gameRef = await db.collection("games").where("gameId", "==", gameId).limit(1).get();
      if (gameRef.empty) { // Most likely a tutorial ending
        // throw new Error("Invalid game ID");
        response.status(200).send({status: 0});
      }

      const gameDoc = gameRef.docs[0];
      const gameData = gameDoc.data();
      if (!gameData) {
        throw new Error("gameData is null");
      }

      for (const player of gameData.players) {
        logPlayerAction(player, "gameComplete", {
          gameId,
          winner: winnerUID == player,
          results: results[player as keyof EndGameData],
          league: gameData.league,
          mode: gameData.mode,
        });
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
      console.error("[saveGameResult] Error:", error);
      response.status(500).send("Error");
    }
  });
});

export const getRemoteConfig = onRequest((request, response) => {
  const remoteConfig = admin.remoteConfig();

  corsMiddleware(request, response, async () => {
    try {
       // Fetch the Remote Config template
      const template = await remoteConfig.getTemplate();

      // Extract parameter values from the template
      const configValues: { [key: string]: any } = {};
      for (const [key, parameter] of Object.entries(template.parameters)) {
        console.log(`Parameter ${key}: ${JSON.stringify(parameter)}`);
        // @ts-ignore
        let value = parameter.defaultValue?.value;
        if (value == "true") value = true;
        if (value == "false") value = false;
        configValues[key] = value;
      }

      // Send the config values as the response
      response.status(200).json(configValues);
    } catch (error) {
      console.error("getRemoteConfig error:", error);
      response.status(500).send("Error fetching remote config");
    }
  });
});

