import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import admin, {corsMiddleware, getUID} from "./APIsetup";

import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";

import {Class} from "@legion/shared/enums";
import {NewCharacter} from "@legion/shared/NewCharacter";

function generateName() {
  // limit names to length of 16 characters
  const dicts = {dictionaries: [adjectives, colors, animals]};
  const base = uniqueNamesGenerator(dicts);
  return base.length > 16 ? base.slice(0, 16) : base;
}

export const createPlayer = functions.auth.user().onCreate((user) => {
  logger.info("Creating character for user:", user.uid);
  const db = admin.firestore();
  const playerRef = db.collection("players").doc(user.uid);

  // Define the character data structure
  const playerData = {
    name: generateName(),
    gold: 120,
    carrying_capacity: 50,
    inventory: {
      consumables: [0, 0, 0, 1, 1, 2, 3, 3],
      equipment: [0, 1, 2],
      spells: [0, 1, 2],
    },
    characters: [] as admin.firestore.DocumentReference[],
    elo: 100,
    league: "Bronze",
    wins: 0,
    losses: 0,
    crowd: 3,
    xp: 0,
    lvl: 1,
  };

  // Start a batch to ensure atomicity
  const batch = db.batch();

  // Add player document to batch
  batch.set(playerRef, playerData);

  const classes = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
  const characterDataArray = [];
  // Repeat 3 times
  for (let i = 0; i < 3; i++) {
    characterDataArray.push(
      new NewCharacter(
        classes[i]
      ).getCharacterData()
    );
  }

  characterDataArray.forEach((characterData) => {
    const characterRef = db.collection("characters").doc();
    batch.set(characterRef, characterData);
    playerData.characters.push(characterRef);
  });

  // Commit the batch
  return batch.commit()
    .then(() => {
      logger.info("New player and characters created for user:", user.uid);
    })
    .catch((error) => {
      logger.info("Error creating player and characters:", error);
    });
});

export const playerData = onRequest((request, response) => {
  logger.info("Fetching playerData");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        const playerData = docSnap.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        response.send({
          gold: playerData.gold,
          elo: playerData.elo,
          lvl: playerData.lvl,
          name: playerData.name,
        });
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("playerData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});
