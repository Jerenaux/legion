import admin from "./APIsetup";
import { RewardType, LockedFeatures } from "@legion/shared/enums";
import { numericalSort } from "@legion/shared/inventory";
import { DBPlayerData } from "@legion/shared/interfaces";
import { LOCKED_FEATURES, UNLOCK_REWARDS } from "@legion/shared/config";

export interface InventoryUpdate {
  inventory?: {
    consumables?: number[];
    spells?: number[];
    equipment?: number[];
  };
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
  }

  return update;
}

export function checkFeatureUnlock(completedGames: number): LockedFeatures | null {
  // Find feature that unlocks at exactly this number of completed games
  for (const [feature, requiredGames] of Object.entries(LOCKED_FEATURES)) {
    if (requiredGames === completedGames) {
      return Number(feature) as LockedFeatures;
    }
  }
  return null;
}

export function getUnlockRewards(feature: LockedFeatures | null): { type: RewardType; id: number; amount: number }[] {
  if (feature === null) return [];
  return UNLOCK_REWARDS[feature];
} 