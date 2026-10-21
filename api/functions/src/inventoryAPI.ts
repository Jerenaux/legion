import {readCharacter, writeCharacter} from './characterStore';
import {playerMutation, MutationError, mutationFailure} from './playerMutation';
import {onRequest} from "./telemetry";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID, firestore} from "./APIsetup";
import {InventoryType, InventoryActionType, ChestColor} from "@legion/shared/enums";
import {DBPlayerData} from "@legion/shared/interfaces";
import {getChestContent} from "@legion/shared/chests";
import {inventoryAction, isRejection, purchaseItem as buyItem} from "@legion/shared/playerActions";
import {inventoryPlayerWrite, playerInventoryCapacity} from "./inventoryUtils";

export const inventoryData = onRequest({
  memory: '512MiB',
}, (request, response) => {
  logger.info("Fetching inventoryData");
  const db = firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const docSnap = await db.collection("players").doc(uid).get();

      if (docSnap.exists) {
        response.send({
          gold: docSnap.data()?.gold,
          inventory: docSnap.data()?.inventory,
          carrying_capacity: playerInventoryCapacity(docSnap.data() as DBPlayerData),
          nb_characters: docSnap.data()?.characters.length,
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

export const purchaseItem = onRequest({memory: '512MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const {articleId: itemId, quantity, inventoryType, requestId} = request.body;
      const result = await playerMutation(uid, 'purchaseItem', requestId, {itemId, quantity, inventoryType},
        (transaction, playerRef, player) => {
          const purchase = buyItem(player, playerInventoryCapacity(player), inventoryType, itemId, quantity);
          if (isRejection(purchase)) throw new MutationError(purchase.status, purchase.error);
          transaction.update(playerRef, {...purchase, 'engagementStats.everPurchased': true});
          return purchase;
        });
      response.send(result);
    } catch (error) { mutationFailure(response, 'purchaseItem', error); }
  });
});

export const inventoryTransaction = onRequest({
  memory: '512MiB',
}, async (request, response) => {
  const db = firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const inventoryType = request.body.inventoryType as InventoryType;
      const action = request.body.action as InventoryActionType;
      const index = request.body.index;
      // Learning a spell in place of the one in this slot; absent for every other action.
      const replaceIndex = request.body.replaceIndex ?? undefined;

      if (typeof characterId !== 'string' || !characterId || characterId.includes('/') || characterId.length > 200) throw new MutationError(400, 'Invalid character ID');
      const playerRef = db.collection("players").doc(uid);
      const characterRef = db.collection("characters").doc(characterId);

      const result = await playerMutation(uid, 'inventoryTransaction', request.body.requestId,
        {characterId, inventoryType, action, index, expectedItemId: request.body.expectedItemId ?? null, replaceIndex: replaceIndex ?? null}, async (transaction, _playerRef, playerData) => {
        const characterDoc = await transaction.get(characterRef);

        if (!characterDoc.exists) {
          throw new MutationError(404, 'Documents do not exist');
        }

        const characterData = readCharacter(characterDoc);

        if (!playerData || !characterData) {
          throw new Error("Data does not exist");
        }

        const characters = playerData.characters as admin.firestore.DocumentReference[];
        const characterIds = characters.map((character) => character.id);
        if (!characterIds.includes(characterId)) {
          throw new MutationError(403, "Character not owned by player");
        }

        const outcome = inventoryAction(playerData, playerInventoryCapacity(playerData), characterData,
          inventoryType, action, index, request.body.expectedItemId, replaceIndex);
        if (isRejection(outcome)) {
          if (outcome.status === 400) throw new MutationError(400, outcome.error);
          logger.info(`[inventoryTransaction] ${outcome.error}`);
          return {status: 1};
        }

        transaction.update(playerRef, {
          ...inventoryPlayerWrite({inventory: outcome.inventory, engagementStats: outcome.engagementStats}),
          ...(outcome.goldGained ? {gold: admin.firestore.FieldValue.increment(outcome.goldGained)} : {}),
        });
        if (outcome.character) writeCharacter(transaction, characterRef, outcome.character);

        return {status: 0};
      });
      response.send(result);
    } catch (error) {
      mutationFailure(response, 'inventoryTransaction', error);
    }
  });
});


export const inventorySave = onRequest({
  memory: '512MiB',
}, (request, response) => {
  const db = firestore();

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
      mutationFailure(response, 'inventorySave', error);
    }
  });
});

export const getReward = onRequest({
  memory: '512MiB',
}, (request, response) => {
  logger.info("Getting reward");

  corsMiddleware(request, response, async () => {
    try {
      const content = getChestContent(request.query.chestType as ChestColor);

      response.send({
        content,
      });
    } catch (error) {
      console.error("getReward error:", error);
      response.status(500).send("Error");
    }
  });
});
