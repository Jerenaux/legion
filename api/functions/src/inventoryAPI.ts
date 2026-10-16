import {balanceCharacter} from '@legion/shared/characterBalance';
import {playerMutation, MutationError, mutationFailure} from './playerMutation';
import {onRequest} from "./telemetry";
import * as logger from "firebase-functions/logger";
import admin, {corsMiddleware, getUID, firestore} from "./APIsetup";
import {getConsumableById} from "@legion/shared/Items";
import {getSpellById} from "@legion/shared/Spells";
import {getEquipmentById} from "@legion/shared/Equipments";
import {InventoryType, InventoryActionType, ShopTab, ChestColor, RewardType, equipmentSlotFields, EquipmentSlot }
  from "@legion/shared/enums";
import {DBCharacterData, Equipment, PlayerInventory} from "@legion/shared/interfaces";
import {inventorySize} from "@legion/shared/utils";
import {getChestContent} from "@legion/shared/chests";
import { getSellPrice,
  numericalSort,
  canEquipConsumable,
  canLearnSpell,
  canEquipEquipment,
  equipConsumable,
  unequipConsumable,
  learnSpell,
  equipEquipment,
  unequipEquipment,
} from '@legion/shared/inventory';


import { addItemsToInventory, inventoryPlayerWrite } from "./inventoryUtils";

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

export const purchaseItem = onRequest({memory: '512MiB'}, (request, response) => {
  corsMiddleware(request, response, async () => {
    try {
      const uid = await getUID(request);
      const {articleId: itemId, quantity, inventoryType, requestId} = request.body;
      if (!Number.isSafeInteger(itemId) || itemId < 0 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
        throw new MutationError(400, 'Invalid purchase');
      }
      const item = inventoryType === ShopTab.CONSUMABLES ? getConsumableById(itemId) :
        inventoryType === ShopTab.SPELLS ? getSpellById(itemId) :
        inventoryType === ShopTab.EQUIPMENTS ? getEquipmentById(itemId) : undefined;
      if (!item || !Number.isFinite(item.price) || item.price <= 0) throw new MutationError(400, 'Invalid article');
      const totalPrice = item.price * quantity;
      const result = await playerMutation(uid, 'purchaseItem', requestId, {itemId, quantity, inventoryType},
        (transaction, playerRef, player) => {
          if (inventorySize(player.inventory) + quantity > player.carrying_capacity) {
            throw new MutationError(409, 'Not enough room in inventory!');
          }
          if (player.gold < totalPrice) throw new MutationError(409, 'Not enough gold!');
          const {inventory} = addItemsToInventory(player,
            inventoryType === ShopTab.CONSUMABLES ? RewardType.CONSUMABLES :
            inventoryType === ShopTab.SPELLS ? RewardType.SPELL : RewardType.EQUIPMENT, itemId, quantity);
          const gold = player.gold - totalPrice;
          transaction.update(playerRef, {gold, inventory, 'engagementStats.everPurchased': true});
          return {gold, inventory};
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

      if (typeof characterId !== 'string' || !characterId || characterId.includes('/') || characterId.length > 200) throw new MutationError(400, 'Invalid character ID');
      const playerRef = db.collection("players").doc(uid);
      const characterRef = db.collection("characters").doc(characterId);

      const result = await playerMutation(uid, 'inventoryTransaction', request.body.requestId,
        {characterId, inventoryType, action, index, expectedItemId: request.body.expectedItemId ?? null}, async (transaction, _playerRef, playerData) => {
        const characterDoc = await transaction.get(characterRef);

        if (!characterDoc.exists) {
          throw new MutationError(404, 'Documents do not exist');
        }

        const characterData = balanceCharacter(characterDoc.data() as DBCharacterData);

        if (!playerData || !characterData) {
          throw new Error("Data does not exist");
        }

        const characters = playerData.characters as admin.firestore.DocumentReference[];
        const characterIds = characters.map((character) => character.id);
        if (!characterIds.includes(characterId)) {
          throw new MutationError(403, "Character not owned by player");
        }

        if (![InventoryType.CONSUMABLES, InventoryType.SPELLS, InventoryType.EQUIPMENTS].includes(inventoryType) ||
            ![InventoryActionType.EQUIP, InventoryActionType.UNEQUIP, InventoryActionType.SELL].includes(action) ||
            !Number.isSafeInteger(index) || index < 0) throw new MutationError(400, 'Invalid inventory action');
        // The player API presents sorted inventory, including older documents stored unsorted.
        for (const items of Object.values(playerData.inventory)) items.sort(numericalSort);
        const selected = action === InventoryActionType.UNEQUIP
          ? inventoryType === InventoryType.CONSUMABLES ? characterData.inventory[index]
            : inventoryType === InventoryType.EQUIPMENTS ? characterData.equipment[equipmentSlotFields[index as EquipmentSlot] as keyof Equipment] : undefined
          : playerData.inventory[inventoryType as keyof PlayerInventory][index];
        if (typeof selected !== 'number' || !Number.isSafeInteger(selected) || selected < 0 ||
            (request.body.expectedItemId !== undefined && selected !== request.body.expectedItemId)) {
          return {status: 1};
        }

        const article = inventoryType === InventoryType.CONSUMABLES ? getConsumableById(selected) :
          inventoryType === InventoryType.SPELLS ? getSpellById(selected) : getEquipmentById(selected);
        if (!article) return {status: 1};

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
            return {status: 1};
          }
        } else if (action === InventoryActionType.UNEQUIP) {
          if (inventorySize(playerData.inventory) >= playerData.carrying_capacity) {
            logger.info("Player inventory full!");
            return {status: 1};
          }
        }

        let update:
          | ReturnType<typeof equipConsumable>
          | ReturnType<typeof learnSpell>
          | ReturnType<typeof equipEquipment>
          | ReturnType<typeof unequipConsumable>
          | ReturnType<typeof unequipEquipment>
          | undefined;
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
        } else if (action === InventoryActionType.SELL) {
          let itemId: number;
          let inventoryField: string;

          switch (inventoryType) {
            case InventoryType.CONSUMABLES:
              itemId = playerData.inventory.consumables[index];
              inventoryField = 'consumables';
              break;
            case InventoryType.SPELLS:
              itemId = playerData.inventory.spells[index];
              inventoryField = 'spells';
              break;
            case InventoryType.EQUIPMENTS:
              itemId = playerData.inventory.equipment[index];
              inventoryField = 'equipment';
              break;
            default:
              throw new Error('Invalid inventory type');
          }

          const itemPrice = getSellPrice(itemId, inventoryType);
          const inventory = { ...playerData.inventory };
          // @ts-expect-error
          inventory[inventoryField] = inventory[inventoryField].filter((_, i) => i !== index);

          transaction.update(playerRef, {
            inventory,
            gold: admin.firestore.FieldValue.increment(itemPrice),
          });

          return {status: 0};
        } else if (action === InventoryActionType.UNEQUIP) {
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
          return {status: 1};
        }

        transaction.update(playerRef, inventoryPlayerWrite(update.playerUpdate));
        transaction.update(characterRef, {...characterData, ...update.characterUpdate});

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
      console.error("inventorySave error:", error);
      response.status(500).send("Error");
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
