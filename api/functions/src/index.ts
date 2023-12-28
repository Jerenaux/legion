import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import cors from "cors";
import {Request} from "express";
import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";

import {items} from "@legion/shared/Items";
import {Class} from "@legion/shared/types";

admin.initializeApp();
const corsOptions = {origin: true};


async function getUID(request: Request): Promise<string> {
  const authToken = request.headers.authorization?.split("Bearer ")[1];
  if (!authToken) {
    throw new Error("Auth token not provided or invalid format");
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(authToken);
    return decodedToken.uid;
  } catch (error) {
    return "";
  }
}


function getSkillSlots(characterClass: Class) {
  switch (characterClass) {
  case Class.WARRIOR:
    return 0;
  case Class.WHITE_MAGE:
    return 3;
  case Class.BLACK_MAGE:
    return 3;
  case Class.THIEF:
    return 1;
  }
}

function getFrame(characterClass: Class) {
  const warriorFrames = [
    "1_1", "1_2", "1_3", "1_4", "2_1", "2_2", "2_6", "2_7", "3_1", "3_6", "3_8",
    "4_7", "4_8", "5_1", "5_2", "5_4", "6_8", "7_4", "mil1_7", "mil1_8",
  ];
  const whiteMageFrames = [
    "1_7", "1_8", "2_8", "3_3", "4_6", "5_6", "6_4", "7_7",
  ];
  const blackMageFrames = [
    "1_5", "1_6", "2_3", "3_2", "4_3", "3_5", "4_5", "5_5", "5_7", "7_6",
  ];
  const thiefFrames = [
    "2_4", "2_5", "3_4", "3_7", "4_2", "5_3", "6_1", "6_2", "6_7",
  ];
  switch (characterClass) {
  case Class.WARRIOR:
    return warriorFrames[Math.floor(Math.random() * warriorFrames.length)];
  case Class.WHITE_MAGE:
    return whiteMageFrames[Math.floor(Math.random() * whiteMageFrames.length)];
  case Class.BLACK_MAGE:
    return blackMageFrames[Math.floor(Math.random() * blackMageFrames.length)];
  case Class.THIEF:
    return thiefFrames[Math.floor(Math.random() * thiefFrames.length)];
  }
}

interface CharacterData {
  name: string;
  portrait: string;
  class: Class;
  level: number;
  xp: number;
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spatk: number;
  spdef: number;
  carrying_capacity: number;
  skill_slots: number;
  inventory: number[];
  skills: number[];
}

function generateCharacterData(): CharacterData {
  // Define the character data structure
  const characterClass = Math.floor(Math.random() * 3) as Class;
  return {
    name: uniqueNamesGenerator({
      dictionaries: [adjectives, colors, animals],
      length: 2,
    }),
    portrait: getFrame(characterClass),
    class: characterClass,
    level: 1,
    xp: 0,
    hp: 100,
    mp: 20,
    atk: 10,
    def: 10,
    spatk: 12,
    spdef: 11,
    carrying_capacity: 3,
    skill_slots: getSkillSlots(characterClass),
    inventory: [],
    skills: [],
  };
}

export const createUserCharacter = functions.auth.user().onCreate((user) => {
  logger.info("Creating character for user:", user.uid);
  const db = admin.firestore();
  const playerRef = db.collection("players").doc(user.uid);

  // Define the character data structure
  const playerData = {
    name: uniqueNamesGenerator({dictionaries: [adjectives, colors, animals]}),
    gold: 100,
    carrying_capacity: 50,
    inventory: [0, 0, 0, 1, 1, 2, 3, 3],
    characters: [] as admin.firestore.DocumentReference[],
    elo: 100,
    wins: 0,
    losses: 0,
    crowd: 3,
  };

  // Start a batch to ensure atomicity
  const batch = db.batch();

  // Add player document to batch
  batch.set(playerRef, playerData);

  // Create character documents and add references to the player document
  const characterDataArray = [
    generateCharacterData(),
    generateCharacterData(),
    generateCharacterData(),
  ];

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

export const helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!!!");
});

export const inventoryData = onRequest((request, response) => {
  logger.info("Fetching inventoryData");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        response.send({
          gold: docSnap.data()?.gold,
          inventory: docSnap.data()?.inventory,
          carrying_capacity: docSnap.data()?.carrying_capacity,
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

export const purchaseItem = onRequest((request, response) => {
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        let gold = docSnap.data()?.gold;
        console.log(`gold: ${gold}`);
        const itemId = request.body.itemId;
        const nb = request.body.quantity;
        const itemPrice = items[itemId].price;
        const totalPrice = itemPrice * nb;
        console.log(`Total price for ${nb} items: ${totalPrice}`);
        if (gold < totalPrice) {
          response.status(500).send("Insufficient gold");
        }

        const inventory = docSnap.data()?.inventory;
        inventory.push(request.body.itemId);
        gold -= totalPrice;
        await db.collection("players").doc(uid).update({
          gold,
          inventory,
        });
        response.send({
          gold,
          inventory,
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

export const fetchLeaderboard = onRequest((request, response) => {
  logger.info("Fetching leaderboard");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const docSnap = await db.collection("players").get();
      const players = docSnap.docs.map((doc) => doc.data());
      const sortedPlayers = players.sort((a, b) => b.elo - a.elo);
      const leaderboard = sortedPlayers.map((player, index) => {
        const denominator = player.wins + player.losses;
        let winsRatio = 0;
        if (denominator === 0) {
          winsRatio = 0;
        } else {
          winsRatio = Math.round((player.wins/denominator));
        }
        return {
          rank: index + 1,
          player: player.name,
          elo: player.elo,
          wins: player.wins,
          losses: player.losses,
          winsRatio: winsRatio*100 + "%",
          crowdScore: player.crowd,
        };
      });
      response.send(leaderboard);
    } catch (error) {
      console.error("Error verifying token:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const rosterData = onRequest((request, response) => {
  logger.info("Fetching rosterData");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        const characters =
          docSnap.data()?.characters as admin.firestore.DocumentReference[];
        const characterDocs = await Promise.all(
          characters.map((character) => character.get())
        );
        const rosterData = characterDocs.map(
          (characterDoc) => {
            const characterData = characterDoc.data();
            return {
              id: characterDoc.id, // Include the document ID
              ...characterData,
            };
          }
        );
        response.send({
          characters: rosterData,
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

export const characterData = onRequest((request, response) => {
  logger.info("Fetching characterData");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);

      // Check that character is owned by player
      const playerDoc = await db.collection("players").doc(uid).get();
      const characters =
        playerDoc.data()?.characters as admin.firestore.DocumentReference[];
      const characterIds = characters.map((character) => character.id);
      if (!characterIds.includes(request.query.id as string)) {
        response.status(404).send("Not Found: character not owned by player");
      }

      if (!request.query.id) {
        response.status(404).send("Not Found: Invalid character ID");
      }
      const docSnap =
        await db.collection("characters").doc(request.query.id as string).get();

      if (docSnap.exists) {
        const characterData = docSnap.data();
        response.send({
          ...characterData,
        });
      } else {
        response.status(404).send("Not Found: Invalid character ID");
      }
    } catch (error) {
      console.error("Error verifying token:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const equipItem = onRequest((request, response) => {
  logger.info("Equipping item");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const index = request.body.index;

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const characterRef = db.collection("characters").doc(characterId);

        const playerDoc = await transaction.get(playerRef);
        const characterDoc = await transaction.get(characterRef);

        if (!playerDoc.exists || !characterDoc.exists) {
          throw new Error("Documents do not exist");
        }

        const playerData = playerDoc.data();
        const characterData = characterDoc.data();

        if (!playerData || !characterData) {
          throw new Error("Data does not exist");
        }

        // Check that character is owned by player
        const characters =
          playerData.characters as admin.firestore.DocumentReference[];
        const characterIds = characters.map((character) => character.id);
        if (!characterIds.includes(characterId)) {
          throw new Error("Character not owned by player");
        }

        const playerInventory = playerData.inventory.sort();

        if (characterData.inventory.length >= characterData.carrying_capacity) {
          response.send({status: 1});
          return;
        }

        const inventory = characterData.inventory as number[];
        const item = playerInventory[index];

        playerInventory.splice(index, 1);
        inventory.push(item);

        // Update player and character documents within the transaction
        transaction.update(playerRef, {inventory: playerInventory});
        transaction.update(characterRef, {inventory});
      });
      console.log("Transaction successfully committed!");

      response.send({status: 0});
    } catch (error) {
      console.error("Error verifying token:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const unequipItem = onRequest((request, response) => {
  logger.info("Unequipping item");
  const db = admin.firestore();

  cors(corsOptions)(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const index = request.body.index;

      await db.runTransaction(async (transaction) => {
        const playerRef = db.collection("players").doc(uid);
        const characterRef = db.collection("characters").doc(characterId);

        const playerDoc = await transaction.get(playerRef);
        const characterDoc = await transaction.get(characterRef);

        if (!playerDoc.exists || !characterDoc.exists) {
          throw new Error("Documents do not exist");
        }

        const playerData = playerDoc.data();
        const characterData = characterDoc.data();

        if (!playerData || !characterData) {
          throw new Error("Data does not exist");
        }

        // Check that character is owned by player
        const characters =
          playerData.characters as admin.firestore.DocumentReference[];
        const characterIds = characters.map((character) => character.id);
        if (!characterIds.includes(characterId)) {
          throw new Error("Character not owned by player");
        }

        const inventory = playerData.inventory.sort();
        const characterInventory = characterData.inventory as number[];
        const item = characterInventory[index];

        if (playerData.inventory.length >= playerData.carrying_capacity) {
          response.send({status: 1});
          return;
        }

        characterInventory.splice(index, 1);
        inventory.push(item);

        // Update player and character documents within the transaction
        transaction.update(playerRef, {inventory});
        transaction.update(characterRef, {inventory: characterInventory});
      });
      console.log("Transaction successfully committed!");

      response.send({status: 0});
    } catch (error) {
      console.error("Error verifying token:", error);
      response.status(401).send("Unauthorized");
    }
  });
});
