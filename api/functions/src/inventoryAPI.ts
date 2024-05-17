import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {getConsumableById} from "@legion/shared/Items";
import {getSpellById} from "@legion/shared/Spells";
import {getEquipmentById} from "@legion/shared/Equipments";
import {InventoryType, InventoryActionType, equipmentFields, EquipmentSlot, ShopTabs, ChestType}
  from "@legion/shared/enums";
import {Equipment} from "@legion/shared/interfaces";
import {inventorySize} from "@legion/shared/utils";
import {getChestContent} from "@legion/shared/chests";

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
        const itemId = request.body.articleId;
        const nb = request.body.quantity;
        const inventoryType = request.body.inventoryType as ShopTabs;
        console.log(`itemId: ${itemId}, nb: ${nb}, inventoryType: ${inventoryType}`);

        let itemPrice = 0;
        switch (inventoryType) {
          case ShopTabs.CONSUMABLES:
            itemPrice = getConsumableById(itemId)?.price || 0;
            break;
          case ShopTabs.SPELLS:
            itemPrice = getSpellById(itemId)?.price || 0;
            break;
          case ShopTabs.EQUIPMENTS:
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

        // Check that the player has enough space in their inventory
        const inventory = docSnap.data()?.inventory;
        if (inventorySize(inventory) + nb > docSnap.data()?.carrying_capacity) {
          response.status(500).send("Inventory full");
          return;
        }

        gold -= totalPrice;

        switch (inventoryType) {
          case ShopTabs.CONSUMABLES:
            for (let i = 0; i < nb; i++) {
              inventory.consumables.push(itemId);
            }
            break;
          case ShopTabs.SPELLS:
            for (let i = 0; i < nb; i++) {
              inventory.spells.push(itemId);
            }
            break;
          case ShopTabs.EQUIPMENTS:
            for (let i = 0; i < nb; i++) {
              inventory.equipment.push(itemId);
            }
            break;
          default:
            response.status(500).send("Invalid inventory type");
            return;
        }

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
      response.status(500).send("Error");
    }
  });
});

function canEquipConsumable(characterData: any) {
  return characterData.inventory.length <
    characterData.carrying_capacity + characterData.carrying_capacity_bonus;
}

function canLearnSpell(characterData: any) {
  return characterData.skills.length < characterData.skill_slots;
}

function canEquipEquipment(characterData: any, equipmentId: any) {
  const equipment = getEquipmentById(equipmentId);
  if (!equipment) {
    console.error("Invalid equipment ID");
    return false;
  }
  return (equipment.minLevel <= characterData.level) && (equipment.classes.includes(characterData.class));
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
  const skills = playerInventory.spells.sort();
  const inventory = characterData.skills as number[];

  // Check if index is valid
  if (index < 0 || index >= skills.length) {
    return -1;
  }

  const item = skills[index];
  // Check if character already knows the spell
  if (inventory.includes(item)) {
    return -1;
  }

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
  const consumables = playerInventory.consumables.sort();
  const equipped = characterData.equipment as Equipment;
  const inventory = characterData.inventory as number[];
  let carrying_capacity_bonus = characterData.carrying_capacity_bonus;

  // Check if index is valid
  if (index < 0 || index >= equipment.length) {
    return -1;
  }

  const item = equipment[index];
  equipment.splice(index, 1);

  const data = getEquipmentById(item);
  if (!data) {
    console.error("Invalid equipment ID");
    return -1;
  }

  let slotNumber: number = data.slot;
  if (slotNumber == EquipmentSlot.LEFT_RING) {
    if (equipped.left_ring !== -1) {
      slotNumber = EquipmentSlot.RIGHT_RING;
    }
  }

  const field = equipmentFields[slotNumber];
  const currentlyEquipped = equipped[field as keyof Equipment];
  if (currentlyEquipped != -1) {
    equipment.push(currentlyEquipped);
  }
  equipped[field as keyof Equipment] = item;

  if (slotNumber == EquipmentSlot.BELT) {
    carrying_capacity_bonus = data.beltSize;

    while (inventory.length >
      characterData.carrying_capacity + carrying_capacity_bonus) {
      const excess = inventory.pop();
      consumables.push(excess);
    }
    playerInventory.consumables = consumables;
  }

  playerInventory.equipment = equipment;
  playerInventory.consumables = consumables;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {
      equipment: equipped,
      equipment_bonuses: applyEquipmentBonuses(equipped),
      carrying_capacity_bonus,
      inventory,
    },
  };
}

function unequipEquipment(playerData: any, characterData: any, index: number) {
  // In this case `index` points to the slot
  const playerInventory = playerData.inventory;
  const equipment = playerInventory.equipment.sort();
  const consumables = playerInventory.consumables.sort();
  const equipped = characterData.equipment as Equipment;
  const inventory = characterData.inventory as number[];
  let carrying_capacity_bonus = characterData.carrying_capacity_bonus;

  if (index < 0 || index >= equipmentFields.length) {
    return -1;
  }

  const slotNumber: number = index;
  const field = equipmentFields[slotNumber];
  const item = equipped[field as keyof Equipment];

  if (item != -1) {
    if (slotNumber == EquipmentSlot.BELT) {
      carrying_capacity_bonus = 0;
      // if characterData.inventory has more elements than carrying_capacity,
      // remove the excess elements and push them to consumables
      while (inventory.length > characterData.carrying_capacity) {
        const excess = inventory.pop();
        consumables.push(excess);
      }
      playerInventory.consumables = consumables;
    }

    equipped[field as keyof Equipment] = -1;
    equipment.push(item);
    playerInventory.equipment = equipment;
  }

  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {
      equipment: equipped,
      equipment_bonuses: applyEquipmentBonuses(equipped),
      carrying_capacity_bonus,
      inventory,
    },
  };
}

function applyEquipmentBonuses(equipped: Equipment) {
  const bonuses = {
    hp: 0,
    mp: 0,
    atk: 0,
    def: 0,
    spatk: 0,
    spdef: 0,
  };
  for (const field of equipmentFields) {
    const item = equipped[field as keyof Equipment];
    if (item !== -1) {
      const data = getEquipmentById(item);
      if (!data) {
        console.error("Invalid equipment ID");
        return bonuses;
      }
      data.effects.forEach((effect) => {
        switch (effect.stat) {
        case 0:
          bonuses.hp += effect.value;
          break;
        case 1:
          bonuses.mp += effect.value;
          break;
        case 2:
          bonuses.atk += effect.value;
          break;
        case 3:
          bonuses.def += effect.value;
          break;
        case 4:
          bonuses.spatk += effect.value;
          break;
        case 5:
          bonuses.spdef += effect.value;
          break;
        }
      });
    }
  }
  return bonuses;
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
          case InventoryType.EQUIPMENTS: {
              const itemId = playerData.inventory.equipment[index];
              canDo = canEquipEquipment(characterData, itemId);
              break;
            }
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
      console.error("inventoryTransaction error:", error);
      response.status(500).send("Error processing transaction");
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

function chestTypeFromString(value: string): ChestType {
  const key = value.toUpperCase() as keyof typeof ChestType;
  if (ChestType[key] === undefined) {
      throw new Error(`Invalid ChestType: ${value}`);
  }
  return ChestType[key];
}

export const getReward = onRequest((request, response) => {
  logger.info("Getting reward");

  corsMiddleware(request, response, async () => {
    try {
      const reward = chestTypeFromString(request.query.chestType as string);
      const content = getChestContent(reward);

      response.send({
        content,
      });
    } catch (error) {
      console.error("getReward error:", error);
      response.status(500).send("Error");
    }
  });
});
