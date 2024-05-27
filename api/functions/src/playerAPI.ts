import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as functions from "firebase-functions";
import admin, {corsMiddleware, getUID} from "./APIsetup";

import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";

import {Class, ChestColor} from "@legion/shared/enums";
import {APIPlayerData, DailyLootAllData} from "@legion/shared/interfaces";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {getChestContent, ChestReward} from "@legion/shared/chests";
import {processChestRewards} from "./characterAPI";

const NB_START_CHARACTERS = 3;

const chestsDelays = {
  [ChestColor.BRONZE]: 6*60*60,
  [ChestColor.SILVER]: 12*60*60,
  [ChestColor.GOLD]: 24*60*60,
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
    dailyloot: {
      [ChestColor.BRONZE]: {
        time: now + chestsDelays.bronze,
        hasKey: false,
      },
      [ChestColor.SILVER]: {
        time: now + chestsDelays.silver,
        hasKey: false,
      },
      [ChestColor.GOLD]: {
        time: now + chestsDelays.gold,
        hasKey: false,
      },
    } as DailyLootAllData,
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

const transformDailyLoot = (dailyloot: DailyLootAllData) => {
  const now = Date.now() / 1000;
  for (const color of Object.values(ChestColor)) {
    const chest = dailyloot[color];
    const timeLeft = chest.time! - now;
    chest.countdown = timeLeft > 0 ? timeLeft : 0;
    delete chest.time;
    dailyloot[color] = chest;
  }
  return dailyloot;
};


export const getPlayerData = onRequest((request, response) => {
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
        playerData.dailyloot = transformDailyLoot(playerData.dailyloot);

        response.send({
          gold: playerData.gold,
          elo: playerData.elo,
          lvl: playerData.lvl,
          name: playerData.name,
          teamName: "teamName",
          avatar: "avatar",
          league: playerData.league,
          rank: 1,
          dailyloot: playerData.dailyloot,
        } as APIPlayerData);
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
      const uid = await getUID(request);
      const chestType = request.query.chestType;
      logger.info("Claiming chest for player:", uid, "chestType:", chestType);

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const playerDoc = await transaction.get(playerRef);

        if (!playerDoc.exists) {
          throw new Error("Invalid player ID");
        }

        const playerData = playerDoc.data();
        if (!playerData) {
          throw new Error("playerData is null");
        }

        const chest = playerData.dailyloot[chestType as keyof DailyLootAllData];
        if (!chest) {
          throw new Error("Invalid chest type");
        }

        const now = Date.now() / 1000;
        if (chest.hasKey && chest.time <= now) {
          playerData.dailyloot[chestType as keyof DailyLootAllData] = {
            time: now + chestsDelays[chestType as keyof DailyLootAllData],
            hasKey: false,
          };

          transaction.update(playerRef, {
            dailyloot: playerData.dailyloot,
          });

          const content: ChestReward[] = getChestContent(chestType as ChestColor);
          logger.info(`Chest content: ${JSON.stringify(content)}`);

          const inventory = playerDoc.data()?.inventory || {};
          const consumables = inventory.consumables || [];
          const spells = inventory.spells || [];
          const equipment = inventory.equipment || [];

          await processChestRewards(transaction, playerRef, content, consumables, spells, equipment);

          const dailyLootResponse = transformDailyLoot(playerData.dailyloot);

          response.send({
            content,
            dailyloot: dailyLootResponse,
          });
        } else {
          response.status(400).send("Chest not ready");
          return;
        }
      });
    } catch (error) {
      console.error("claimChest error:", error);
      response.status(500).send("Error");
    }
  });
});

