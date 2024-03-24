import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {items} from "@legion/shared/Items";
import {equipments} from "@legion/shared/Equipments";
import {InventoryType, InventoryActionType}
  from "@legion/shared/enums";
import {Equipment} from "@legion/shared/interfaces";

const equipmentFields = ["weapon", "helmet", "armor", "belt", "gloves",
  "boots", "left_ring", "right_ring", "necklace"];

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

function canEquipConsumable(characterData: any) {
  return characterData.inventory.length < characterData.carrying_capacity;
}

function canLearnSpell(characterData: any) {
  return characterData.skills.length < characterData.skill_slots;
}

function equipConsumable(playerData: any, characterData: any, index: number) {
  const playerInventory = playerData.inventory;
  const consumables = playerInventory.consumables.sort();
  const inventory = characterData.inventory as number[];

  // Check if index is valid
  if (index < 0 || index >= consumables.length) {
    return -1;
  }

  const item = consumables[index];
  consumables.splice(index, 1);
  inventory.push(item);

  playerInventory.consumables = consumables;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {inventory},
  };
}

function unequipConsumable(playerData: any, characterData: any, index: number) {
  const playerInventory = playerData.inventory;
  const consumables = playerInventory.consumables.sort();
  const inventory = characterData.inventory as number[];

  // Check if index is valid
  if (index < 0 || index >= inventory.length) {
    return -1;
  }

  const item = inventory[index];
  inventory.splice(index, 1);
  consumables.push(item);

  playerInventory.consumables = consumables;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {inventory},
  };
}

function learnSpell(playerData: any, characterData: any, index: number) {
  const playerInventory = playerData.inventory;
  const skills = playerInventory.skills.sort();
  const inventory = characterData.skills as number[];

  // Check if index is valid
  if (index < 0 || index >= skills.length) {
    return -1;
  }

  const item = skills[index];
  skills.splice(index, 1);
  inventory.push(item);

  playerInventory.skills = skills;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {skills: inventory},
  };
}

function equipEquipment(playerData: any, characterData: any, index: number) {
  const playerInventory = playerData.inventory;
  const equipment = playerInventory.equipment.sort();
  const equipped = characterData.equipment as Equipment;

  // Check if index is valid
  if (index < 0 || index >= equipment.length) {
    return -1;
  }

  const item = equipment[index];
  equipment.splice(index, 1);

  const data = equipments[item];
  const slotNumber: number = data.slot;

  const field = equipmentFields[slotNumber];
  if (equipped[field as keyof Equipment] !== -1) {
    equipment.push(equipped[field as keyof Equipment]);
  }
  equipped[field as keyof Equipment] = item;

  playerInventory.equipment = equipment;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {equipment: equipped},
  };
}

function unequipEquipment(playerData: any, characterData: any, index: number) {
  // In this case `index` points to the slot
  const playerInventory = playerData.inventory;
  const equipment = playerInventory.equipment.sort();
  const equipped = characterData.equipment as Equipment;

  // Check if index is valid
  if (index < 0 || index >= equipmentFields.length) {
    return -1;
  }

  const slotNumber: number = index;
  const field = equipmentFields[slotNumber];

  const item = equipped[field as keyof Equipment];
  equipped[field as keyof Equipment] = -1;
  equipment.push(item);

  playerInventory.equipment = equipment;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {equipment: equipped},
  };
}

export const inventoryTransaction = onRequest((request, response) => {
  logger.info("Processing inventory transaction");
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request); // request.body.uid;
      const characterId = request.body.characterId as string;
      const inventoryType = request.body.inventoryType as InventoryType;
      const action = request.body.action as InventoryActionType;
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

        // Check for max capacity, if applicable
        if (action === InventoryActionType.EQUIP) {
          let canDo = false;
          switch (inventoryType) {
          case InventoryType.CONSUMABLES:
            canDo = canEquipConsumable(characterData);
            break;
          case InventoryType.SKILLS:
            canDo = canLearnSpell(characterData);
            break;
          case InventoryType.EQUIPMENTS:
            canDo = true;
            break;
          }
          if (!canDo) {
            response.send({status: 1});
            return;
          }
        } else { // unequipping
          // Sum the length of the fields in playerData.inventory
          const load = Object.values(playerData.inventory)
            .filter(Array.isArray)
            .map((arr) => arr.length)
            .reduce((acc, curr) => acc + curr, 0);
          if (load == characterData.carrying_capacity) {
            response.send({status: 1});
            return;
          }
        }

        let update;
        if (action === InventoryActionType.EQUIP) {
          switch (inventoryType) {
          case InventoryType.CONSUMABLES:
            update = equipConsumable(playerData, characterData, index);
            break;
          case InventoryType.SKILLS:
            update = learnSpell(playerData, characterData, index);
            break;
          case InventoryType.EQUIPMENTS:
            update = equipEquipment(playerData, characterData, index);
            break;
          }
        } else { // unequipping
          switch (inventoryType) {
          case InventoryType.CONSUMABLES:
            update = unequipConsumable(playerData, characterData, index);
            break;
          case InventoryType.EQUIPMENTS:
            update = unequipEquipment(playerData, characterData, index);
            break;
          }
        }

        if (update === -1) {
          response.send({status: 1});
          return;
        }
        if (typeof update != "number" && update !== undefined) {
          transaction.update(playerRef, update.playerUpdate);
          transaction.update(characterRef, update.characterUpdate);
        }
      });
      console.log("Transaction successfully committed!");

      response.send({status: 0});
    } catch (error) {
      console.error("equipItem error:", error);
      response.status(500).send("Error processing transaction");
    }
  });
});
