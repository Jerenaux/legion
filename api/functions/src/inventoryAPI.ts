import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {getConsumableById} from "@legion/shared/Items";
import {getSpellById} from "@legion/shared/Spells";
import {getEquipmentById} from "@legion/shared/Equipments";
import {InventoryType, InventoryActionType, ShopTab, ChestColor}
  from "@legion/shared/enums";
import {DBCharacterData, DBPlayerData} from "@legion/shared/interfaces";
import {inventorySize} from "@legion/shared/utils";
import {getChestContent} from "@legion/shared/chests";
import {logPlayerAction} from "./dashboardAPI";
import { numericalSort } from "@legion/shared/inventory";

import {
  canEquipConsumable,
  canLearnSpell,
  canEquipEquipment,
  equipConsumable,
  unequipConsumable,
  learnSpell,
  equipEquipment,
  unequipEquipment,
} from '@legion/shared/inventory';

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

export const purchaseItem = onRequest((request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const playerDocRef = db.collection("players").doc(uid);
      const docSnap = await playerDocRef.get();

      if (docSnap.exists) {
        const itemId = request.body.articleId;
        const nb = request.body.quantity;
        const inventoryType = request.body.inventoryType as ShopTab;

        // Check that the player has enough space in their inventory
        const inventory = docSnap.data()?.inventory;
        if (inventorySize(inventory) + nb > docSnap.data()?.carrying_capacity) {
          response.status(500).send("Inventory full");
          return;
        }

        let itemPrice = 0;
        switch (inventoryType) {
          case ShopTab.CONSUMABLES:
            itemPrice = getConsumableById(itemId)?.price || 0;
            break;
          case ShopTab.SPELLS:
            itemPrice = getSpellById(itemId)?.price || 0;
            break;
          case ShopTab.EQUIPMENTS:
            itemPrice = getEquipmentById(itemId)?.price || 0;
            break;
          default:
            response.status(500).send("Invalid inventory type");
            return;
        }
        const totalPrice = itemPrice * nb;

        let gold = docSnap.data()?.gold;
        if (gold < totalPrice) {
          response.status(500).send("Insufficient gold");
          return;
        }

        gold -= totalPrice;

        const inventoryUpdate = { ...inventory };
        switch (inventoryType) {
          case ShopTab.CONSUMABLES:
            inventoryUpdate.consumables = [...inventory.consumables, ...Array(nb).fill(itemId)].sort(numericalSort);
            break;
          case ShopTab.SPELLS:
            inventoryUpdate.spells = [...inventory.spells, ...Array(nb).fill(itemId)].sort(numericalSort);
            break;
          case ShopTab.EQUIPMENTS:
            inventoryUpdate.equipment = [...inventory.equipment, ...Array(nb).fill(itemId)].sort(numericalSort);
            break;
        }

        const result = await db.runTransaction(async (transaction) => {
          transaction.update(playerDocRef, {
            gold,
            inventory: inventoryUpdate,
          });
          transaction.update(playerDocRef, {
            'utilizationStats.everPurchased': true,
          });

          return { gold, inventory: inventoryUpdate };
        });

        logPlayerAction(uid, "purchaseItem", {inventoryType, itemId, nb, totalPrice});

        response.send(result);
      } else {
        response.status(404).send("Not Found: Invalid player ID");
      }
    } catch (error) {
      console.error("purchaseItem error:", error);
      response.status(500).send("Error");
    }
  });
});

export const inventoryTransaction = onRequest(async (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const inventoryType = request.body.inventoryType as InventoryType;
      const action = request.body.action as InventoryActionType;
      const index = request.body.index;

      const playerRef = db.collection("players").doc(uid);
      const characterRef = db.collection("characters").doc(characterId);

      const playerDoc = await playerRef.get();
      const characterDoc = await characterRef.get();

      if (!playerDoc.exists || !characterDoc.exists) {
        throw new Error('Documents do not exist');
      }

      const playerData = playerDoc.data() as DBPlayerData;
      const characterData = characterDoc.data() as DBCharacterData;

      if (!playerData || !characterData) {
        throw new Error("Data does not exist");
      }

      const characters = playerData.characters as admin.firestore.DocumentReference[];
      const characterIds = characters.map((character) => character.id);
      if (!characterIds.includes(characterId)) {
        throw new Error("Character not owned by player");
      }

      let canDo = false;
      if (action === InventoryActionType.EQUIP) {
        switch (inventoryType) {
          case InventoryType.CONSUMABLES:
            canDo = canEquipConsumable(characterData);
            break;
          case InventoryType.SPELLS:
            canDo = canLearnSpell(characterData, playerData.inventory.spells[index]);
            break;
          case InventoryType.EQUIPMENTS:
            canDo = canEquipEquipment(characterData, playerData.inventory.equipment[index]);
            break;
        }
        if (!canDo) {
          logger.info("[inventoryTransaction] Conditions not fulfilled to equip item");
          response.send({ status: 1 });
          return;
        }
      } else {
        if (inventorySize(playerData.inventory) >= playerData.carrying_capacity) {
          logger.info("Player inventory full!");
          response.send({ status: 1 });
          return;
        }
      }

      let update;
      if (action === InventoryActionType.EQUIP) {
        switch (inventoryType) {
          case InventoryType.CONSUMABLES:
            update = equipConsumable(playerData, characterData, index);
            break;
          case InventoryType.SPELLS:
            update = learnSpell(playerData, characterData, index);
            break;
          case InventoryType.EQUIPMENTS:
            update = equipEquipment(playerData, characterData, index);
            break;
        }
      } else {
        switch (inventoryType) {
          case InventoryType.CONSUMABLES:
            update = unequipConsumable(playerData, characterData, index);
            break;
          case InventoryType.EQUIPMENTS:
            update = unequipEquipment(playerData, characterData, index);
            break;
        }
      }

      if (!update) {
        logger.info("No update to perform");
        response.send({ status: 1 });
        return;
      }

      await playerRef.update(update.playerUpdate);
      console.log(`[inventoryTransaction] Character update: ${JSON.stringify(update.characterUpdate)}`);
      await characterRef.update(update.characterUpdate);

      await logPlayerAction(uid, "inventoryTransaction", { action, characterId, inventoryType, index });

      response.send({ status: 0 });
    } catch (error) {
      console.error("inventoryTransaction error:", error);
      response.status(500).send("Error processing transaction");
    }
  });
});


export const inventorySave = onRequest((request, response) => {
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

export const getReward = onRequest((request, response) => {
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
