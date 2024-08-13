import {onRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID} from "./APIsetup";
import {getConsumableById} from "@legion/shared/Items";
import {getSpellById} from "@legion/shared/Spells";
import {getEquipmentById} from "@legion/shared/Equipments";
import {InventoryType, InventoryActionType, equipmentFields, EquipmentSlot, ShopTabs, ChestColor}
  from "@legion/shared/enums";
import {Equipment, DBCharacterData, DBPlayerData, PlayerInventory, CharacterStats} from "@legion/shared/interfaces";
import {inventorySize} from "@legion/shared/utils";
import {getChestContent} from "@legion/shared/chests";
import {logPlayerAction} from "./dashboardAPI";

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
        const inventoryType = request.body.inventoryType as ShopTabs;
        console.log(`itemId: ${itemId}, nb: ${nb}, inventoryType: ${inventoryType}`);

        // Check that the player has enough space in their inventory
        const inventory = docSnap.data()?.inventory;
        if (inventorySize(inventory) + nb > docSnap.data()?.carrying_capacity) {
          response.status(500).send("Inventory full");
          return;
        }

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

        gold -= totalPrice;

        const inventoryUpdate = { ...inventory };
        switch (inventoryType) {
          case ShopTabs.CONSUMABLES:
            inventoryUpdate.consumables = [...inventory.consumables, ...Array(nb).fill(itemId)];
            break;
          case ShopTabs.SPELLS:
            inventoryUpdate.spells = [...inventory.spells, ...Array(nb).fill(itemId)];
            break;
          case ShopTabs.EQUIPMENTS:
            inventoryUpdate.equipment = [...inventory.equipment, ...Array(nb).fill(itemId)];
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

function canEquipConsumable(characterData: DBCharacterData): boolean {
  return characterData.inventory.length <
    characterData.carrying_capacity + characterData.carrying_capacity_bonus;
}

function canLearnSpell(characterData: DBCharacterData, spellId: number): boolean {
  const spell = getSpellById(spellId);
  if (!spell) {
    console.error("Invalid spell ID");
    return false;
  }
  return (
    spell.minLevel <= characterData.level) &&
    (!spell.classes.length || spell.classes.includes(characterData.class) &&
    characterData.skills.length < characterData.skill_slots
  );
}

function canEquipEquipment(characterData: DBCharacterData, equipmentId: number): boolean {
  console.log(`[canEquipEquipment] equipmentId: ${equipmentId}`);
  const equipment = getEquipmentById(equipmentId);
  if (!equipment) {
    console.error("Invalid equipment ID");
    return false;
  }
  console.log(`[canEquipEquipment] Equipment name: ${equipment.name} Character level: ${characterData.level}, Equipment min level: ${equipment.minLevel}, Equipment classes: ${equipment.classes}, Character class: ${characterData.class}`);
  return (equipment.minLevel <= characterData.level) && (!equipment.classes.length || equipment.classes.includes(characterData.class));
}

interface EquipUnequipOutcome {
  playerUpdate: {
    inventory: PlayerInventory;
  };
  characterUpdate: {
    inventory?: number[];
    skills?: number[];
    equipment?: Equipment;
    equipment_bonuses?: CharacterStats;
    carrying_capacity_bonus?: number;
  };
}

function equipConsumable(playerData: DBPlayerData, characterData: DBCharacterData, index: number): EquipUnequipOutcome | number {
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

function unequipConsumable(playerData: DBPlayerData, characterData: DBCharacterData, index: number): EquipUnequipOutcome | number {
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

function learnSpell(playerData: DBPlayerData, characterData: DBCharacterData, index: number): EquipUnequipOutcome | number {
  const playerInventory = playerData.inventory;
  const spells = playerInventory.spells.sort();
  const inventory = characterData.skills as number[];

  // Check if index is valid
  if (index < 0 || index >= spells.length) {
    return -1;
  }

  const item = spells[index];
  // Check if character already knows the spell
  if (inventory.includes(item)) {
    return -1;
  }

  spells.splice(index, 1);
  inventory.push(item);

  playerInventory.spells = spells;
  return {
    playerUpdate: {inventory: playerInventory},
    characterUpdate: {skills: inventory},
  };
}

function equipEquipment(playerData: DBPlayerData, characterData: DBCharacterData, index: number): EquipUnequipOutcome | number {
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

  let slotNumber: number = data?.slot ?? 0;
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
    if (!data.beltSize) {
      console.error("Invalid belt size");
      return -1;
    }
    carrying_capacity_bonus = data.beltSize;

    while (inventory.length >
      characterData.carrying_capacity + carrying_capacity_bonus) {
      const excess = inventory.pop();
      if (excess) consumables.push(excess);
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

function unequipEquipment(playerData: DBPlayerData, characterData: DBCharacterData, index: number): EquipUnequipOutcome | number {
  console.log(`[unequipEquipment] index: ${index}`);
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
  console.log(`[unequipEquipment] field: ${field}, item: ${item}`);

  if (item != -1) {
    if (slotNumber == EquipmentSlot.BELT) {
      carrying_capacity_bonus = 0;
      // if characterData.inventory has more elements than carrying_capacity,
      // remove the excess elements and push them to consumables
      while (inventory.length > characterData.carrying_capacity) {
        const excess = inventory.pop();
        if (excess) consumables.push(excess);
      }
      playerInventory.consumables = consumables;
    }

    equipped[field as keyof Equipment] = -1;
    equipment.push(item);
    playerInventory.equipment = equipment;
  }

  // console.log(`[unequipEquipment] inventory updated: ${playerInventory.equipment}`);

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

function applyEquipmentBonuses(equipped: Equipment): CharacterStats {
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

export const inventoryTransaction = onRequest(async (request, response) => {
  const db = admin.firestore();

  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const characterId = request.body.characterId as string;
      const inventoryType = request.body.inventoryType as InventoryType;
      const action = request.body.action as InventoryActionType;
      const index = request.body.index;
      console.log(`[inventoryTransaction] uid: ${uid}, characterId: ${characterId}, inventoryType: ${inventoryType}, action: ${action}, index in inventory: ${index}`);

      const playerRef = db.collection("players").doc(uid);
      const characterRef = db.collection("characters").doc(characterId);

      const playerDoc = await playerRef.get();
      const characterDoc = await characterRef.get();

      if (!playerDoc.exists || !characterDoc.exists) {
        throw new Error("Documents do not exist");
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
          case InventoryType.SKILLS: {
            const spellId = playerData.inventory.spells.sort()[index];
            canDo = canLearnSpell(characterData, spellId);
            break;
          }
          case InventoryType.EQUIPMENTS: {
            const itemId = playerData.inventory.equipment.sort()[index];
            canDo = canEquipEquipment(characterData, itemId);
            break;
          }
        }
        if (!canDo) {
          logger.info("Conditions not fulfilled to equip item");
          response.send({ status: 1 });
          return;
        }
      } else {
        const load = Object.values(playerData.inventory)
          .filter(Array.isArray)
          .map((arr) => arr.length)
          .reduce((acc, curr) => acc + curr, 0);

        if (load >= playerData.carrying_capacity) {
          logger.info("Carrying capacity full!");
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
          case InventoryType.SKILLS:
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

      if (update === -1) {
        logger.info("No update to perform");
        response.send({ status: 1 });
        return;
      }

      if (typeof update != "number" && update !== undefined) {
        await playerRef.update(update.playerUpdate);
        await characterRef.update(update.characterUpdate);
      }

      await logPlayerAction(uid, "inventoryTransaction", { action, characterId, inventoryType, index });

      response.send({ status: 0 });
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
