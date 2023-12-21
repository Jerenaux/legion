import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import cors from "cors";

admin.initializeApp();
const corsOptions = {origin: true};


async function getUID(request: any) {
  const authToken = request.headers.authorization?.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(authToken);
    return decodedToken.uid;
  } catch (error) {
    return "";
  }
}

export const createUserCharacter = functions.auth.user().onCreate((user) => {
  logger.info("Creating character for user:", user.uid);
  const db = admin.firestore();

  // Define the character data structure
  const playerData = {
    gold: 100,
  };

  return db.collection("players").doc(user.uid).set(playerData)
    .then(() => {
      logger.info("New player created for user:", user.uid);
    })
    .catch((error) => {
      logger.info("Error creating player:", error);
    });
});

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!!!");
});

export const leaderboardData = onRequest((request, response) => {
  response.send([
    {rank: 1, player: "Player1", elo: 1500, wins: 10, losses: 2,
      winsRatio: Math.round((10/(10+2))*100) + "%", crowdScore: 5},
    {rank: 2, player: "Player2", elo: 1400, wins: 8, losses: 3,
      winsRatio: Math.round((8/(8+3))*100) + "%", crowdScore: 3},
    {rank: 3, player: "Me", elo: 1300, wins: 7, losses: 3,
      winsRatio: Math.round((7/(7+3))*100) + "%", crowdScore: 3},
  ]);
});


export const inventoryData = onRequest((request, response) => {
  logger.info("Fetching inventoryData");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        const gold = docSnap.data()?.gold;
        response.send({
          gold,
        });
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      response.status(401).send("Unauthorized");
    }
  });
});


