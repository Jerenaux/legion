import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {checkAPIKey, corsMiddleware} from "./APIsetup";
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
      const stake = request.body.stake;

      const gameData = {
        date: new Date(),
        gameId,
        players,
        mode,
        league,
        status: GameStatus.ONGOING,
        stake,
      };

      await db.collection("games").add(gameData);

      for (const player of players) {
        logPlayerAction(player, "gameStart", {
          gameId,
          league: gameData.league,
          mode: gameData.mode,
          stake: gameData.stake,
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
      // Filter out the results object to remove keys that are empty strings or undefined
      const results = Object.fromEntries(
        Object.entries(rawResults).filter(([key, value]) => key !== '' && value !== undefined)
      );
      console.log(`[completeGame] Filtered results: ${JSON.stringify(results)}`);

      const gameRef = await db.collection("games").where("gameId", "==", gameId).limit(1).get();
      if (gameRef.empty) { // Most likely a tutorial ending
        // throw new Error("Invalid game ID");
        response.status(200).send({status: 0});
        return; // Exit the function early
      }

      const gameDoc = gameRef.docs[0];
      const gameData = gameDoc.data();
      if (!gameData) {
        throw new Error("gameData is null");
      }

      for (const player of gameData.players) {
        if (player) { // Add a check to ensure player is not undefined or empty string
          logPlayerAction(player, "gameComplete", {
            gameId,
            winner: winnerUID == player,
            results: results[player as keyof EndGameData],
            league: gameData.league,
            mode: gameData.mode,
          });
        }
      }

      const newGameData = {
        status: GameStatus.COMPLETED,
        winner: winnerUID,
        results,
        end: new Date(),
      };

      // Only add results to newGameData if it's not empty
      if (Object.keys(results).length > 0) {
        newGameData['results'] = results;
      }

      await gameDoc.ref.update(newGameData);
      response.status(200).send({status: 0});
    } catch (error) {
      console.error("[completeGame] Error:", error);
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

export const getNews = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const newsCollection = db.collection("news");
      const newsSnapshot = await newsCollection.get();
      const newsData = newsSnapshot.docs.map(doc => doc.data());
      response.status(200).json(newsData);
    } catch (error) {
      console.error("getNews error:", error);
      response.status(500).send("Error fetching news");
    }
  });
});

export const addNews = onRequest({secrets: ["API_KEY"]}, (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      if (!checkAPIKey(request)) {
        response.status(401).send('Unauthorized');
        return;
      }

      const newsData = request.body;
      await db.collection("news").add(newsData);
      response.status(200).send("News added successfully");
    } catch (error) {
      console.error("addNews error:", error);
      response.status(500).send("Error adding news");
    }
  });
});
