import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {items} from "@legion/shared/Items";

export const inventoryData = onRequest((request, response) => {
  logger.info("Fetching inventoryData");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
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
      console.error("inventoryData error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const purchaseItem = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        let gold = docSnap.data()?.gold;
        console.log(`gold: ${gold}`);
        const itemId = request.body.articleId;
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
      console.error("purchaseItem error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const equipItem = onRequest((request, response) => {
  logger.info("Equipping item");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
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
      console.error("equipItem error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const unequipItem = onRequest((request, response) => {
  logger.info("Unequipping item");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
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
      console.error("unequipItem error:", error);
      response.status(401).send("Unauthorized");
    }
  });
});

export const inventorySave = onRequest((request, response) => {
  logger.info("Saving inventory");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const inventory = request.body.inventory as number[];

      const playerRef = db.collection("players").doc(uid);
      const characterRef = db.collection("characters").doc(characterId);

      const playerDoc = await playerRef.get();
      const characterDoc = await characterRef.get();

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

      // Update character document
      await characterRef.update({inventory});

      response.send({status: 0});
    } catch (error) {
      console.error("inventorySave error:", error);
      response.status(500).send("Error");
    }
  });
});
