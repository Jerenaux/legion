import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import admin, {corsMiddleware, getUID} from "./APIsetup";

import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";

import {Class} from "@legion/shared/enums";
import {ChestsData} from "@legion/shared/interfaces";
import {NewCharacter} from "@legion/shared/NewCharacter";

const NB_START_CHARACTERS = 3;

const chestsDelays = {
  bronze: 6*60*60,
  silver: 12*60*60,
  gold: 24*60*60,
};

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
  const now = Date.now() / 1000;

  // Define the character data structure
  const playerData = {
    name: generateName(),
    gold: 120,
    carrying_capacity: 40,
    inventory: {
      consumables: [0, 0, 0, 1, 1, 2, 3, 3],
      equipment: [0, 1, 2],
      spells: [0, 1, 2],
    },
    characters: [] as admin.firestore.DocumentReference[],
    elo: 100,
    league: 0,
    wins: 0,
    losses: 0,
    xp: 0,
    lvl: 1,
    chests: {
      bronze: {
        time: now + chestsDelays.bronze,
        hasKey: false,
      },
      silver: {
        time: now + chestsDelays.silver,
        hasKey: false,
      },
      gold: {
        time: now + chestsDelays.gold,
        hasKey: false,
      },
    },
  };

  // Start a batch to ensure atomicity
  const batch = db.batch();

  // Add player document to batch
  batch.set(playerRef, playerData);

  const classes = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
  const characterDataArray = [];

  for (let i = 0; i < NB_START_CHARACTERS; i++) {
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

        // Transform the chest field so that the `time` field becomes
        // a `countdown` field
        const now = Date.now() / 1000;
        const chestKeys = Object.keys(playerData.chests);
        chestKeys.forEach((key) => {
          const chest = playerData.chests[key];
          const timeLeft = chest.time - now;
          chest.countdown = timeLeft > 0 ? timeLeft : 0;
          delete chest.time;
        });

        response.send({
          gold: playerData.gold,
          elo: playerData.elo,
          lvl: playerData.lvl,
          name: playerData.name,
          league: playerData.league,
          chests: playerData.chests,
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

export const queuingData = onRequest((request, response) => {
  logger.info("Fetching queuingData");
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
          elo: playerData.elo,
          league: playerData.league,
        });
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("queuingData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const saveGoldReward = onRequest((request, response) => {
  logger.info("Saving gold reward");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = request.body.uid;
      const gold = request.body.gold;

      const playerRef = db.collection("players").doc(uid);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        throw new Error("Invalid player ID");
      }

      const playerData = playerDoc.data();
      if (!playerData) {
        throw new Error("playerData is null");
      }

      const newGold = playerData.gold + gold;

      await playerRef.update({
        gold: newGold,
      });

      response.send({
        gold: newGold,
      });
    } catch (error) {
      console.error("saveGoldReward error:", error);
      response.status(500).send("Error");
    }
  });
});

export const claimChest = onRequest((request, response) => {
  logger.info("Claiming chest");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = request.body.uid;
      const chestType = request.body.chestType;

      const playerRef = db.collection("players").doc(uid);
      const playerDoc = await playerRef.get();

      if (!playerDoc.exists) {
        throw new Error("Invalid player ID");
      }

      const playerData = playerDoc.data();
      if (!playerData) {
        throw new Error("playerData is null");
      }

      const chest = playerData.chests[chestType as keyof ChestsData];
      if (!chest) {
        throw new Error("Invalid chest type");
      }

      if (chest.hasKey && chest.time <= Date.now()) {
        playerData.chests[chestType as keyof ChestsData] = {
          time: Date.now() + chestsDelays[chestType as keyof ChestsData],
          hasKey: false,
        };

        await playerRef.update({
          chests: playerData.chests,
        });

        response.send({
          chestType,
          hasKey: chest.hasKey,
        });
      } else {
        response.status(400).send("Chest not ready");
      }
    } catch (error) {
      console.error("claimChest error:", error);
      response.status(500).send("Error");
    }
  });
});

