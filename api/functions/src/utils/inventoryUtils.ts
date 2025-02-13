import admin from "../APIsetup";
import { RewardType } from "@legion/shared/enums";
import { numericalSort } from "@legion/shared/inventory";
import { DBPlayerData } from "@legion/shared/interfaces";

export interface InventoryUpdate {
  inventory?: {
    consumables?: number[];
    spells?: number[];
    equipment?: number[];
  };
  gold?: admin.firestore.FieldValue;
}

export function addItemsToInventory(
  playerData: DBPlayerData,
  itemType: RewardType,
  itemId: number,
  quantity: number
): InventoryUpdate {
  const update: InventoryUpdate = {
    inventory: { ...playerData.inventory }
  };

  switch (itemType) {
    case RewardType.CONSUMABLES:
      update.inventory!.consumables = [
        ...playerData.inventory.consumables,
        ...Array(quantity).fill(itemId)
      ].sort(numericalSort);
      break;
    case RewardType.SPELL:
      update.inventory!.spells = [
        ...playerData.inventory.spells,
        ...Array(quantity).fill(itemId)
      ].sort(numericalSort);
      break;
    case RewardType.EQUIPMENT:
      update.inventory!.equipment = [
        ...playerData.inventory.equipment,
        ...Array(quantity).fill(itemId)
      ].sort(numericalSort);
      break;
    case RewardType.GOLD:
      update.gold = admin.firestore.FieldValue.increment(quantity);
      delete update.inventory;
      break;
  }

  return update;
}

export function checkFeatureUnlock(completedGames: number): number[] {
  const { LOCKED_FEATURES } = require("@legion/shared/config");
  return Object.entries(LOCKED_FEATURES)
    .filter(([_, requiredGames]) => completedGames === requiredGames)
    .map(([feature]) => parseInt(feature));
}

export function getUnlockRewards(features: number[]): { type: RewardType; id: number; amount: number }[] {
  const { UNLOCK_REWARDS } = require("@legion/shared/config");
  return features.flatMap(feature => UNLOCK_REWARDS[feature] || []);
} 