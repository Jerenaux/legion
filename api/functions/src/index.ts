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
    return -1;
  }
}

export const createUserCharacter = functions.auth.user().onCreate((user) => {
  logger.info("Creating character for user:", user.uid);
  const db = admin.firestore();

  // Define the character data structure
  const characterData = {
    // ... your character data structure ...
    gold: 100, // example field
    level: 1, // example field
    // ... other character fields ...
  };

  return db.collection("characters").doc(user.uid).set(characterData)
    .then(() => {
      logger.info("New character created for user:", user.uid);
    })
    .catch((error) => {
      logger.info("Error creating character:", error);
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
  logger.info("inventoryData");
  const db = admin.firestore();
  cors(corsOptions)(request, response, async () => {
    // logger.info(doesPlayerExist(db, "0"));
    const docRef = db.collection("players").doc("0");
    const docSnap = await docRef.get();
    // logger.info(docSnap.exists);
    logger.info(docSnap.data()!.gold);
    console.log(await db.collection("players").get());

    const inventories: { [key: string]: number[] } = {
      "0": [0, 0, 0, 2, 5],
      "1": [1, 1, 1, 3, 6],
    };

    try {
      const uid = await getUID(request);

      if (Object.prototype.hasOwnProperty.call(inventories, uid)) {
        response.send(inventories[uid]);
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      response.status(401).send("Unauthorized");
    }
  });
});


