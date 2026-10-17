
import { RewardType, LockedFeatures } from "@legion/shared/enums";
import { numericalSort } from "@legion/shared/inventory";
import { DBPlayerData, EngagementStats, PlayerInventory } from "@legion/shared/interfaces";
import { LOCKED_FEATURES, UNLOCK_REWARDS } from "@legion/shared/config";
import { inventoryCapacity } from "@legion/shared/playerActions";

export interface InventoryUpdate {
  inventory?: {
    consumables?: number[];
    spells?: number[];
    equipment?: number[];
  };
}

// Inventory helpers include a copy of the profile they read. Never persist that
// whole map: a match may have incremented completedGames since the read.
export function inventoryPlayerWrite(update: {inventory: PlayerInventory; engagementStats?: Partial<EngagementStats>}) {
  const fields: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {inventory: update.inventory};
  for (const flag of ['everEquippedConsumable', 'everEquippedSpell', 'everEquippedEquipment'] as const) {
    if (update.engagementStats?.[flag]) fields[`engagementStats.${flag}`] = true;
  }
  return fields;
}

/** The capacity players see; the stored carrying_capacity field is a stale creation-time value. */
export function playerInventoryCapacity(player: Pick<DBPlayerData, 'characters' | 'purchasedInventorySlots'>) {
  return inventoryCapacity(player.characters?.length ?? 0, player.purchasedInventorySlots ?? 0);
}

export function addItemsToInventory(
  playerData: DBPlayerData,
  itemType: RewardType,
  itemId: number,
  quantity: number
): InventoryUpdate {
  const update: InventoryUpdate = {
    inventory: { ...playerData.inventory },
  };

  switch (itemType) {
    case RewardType.CONSUMABLES:
      update.inventory!.consumables = [
        ...playerData.inventory.consumables,
        ...Array(quantity).fill(itemId),
      ].sort(numericalSort);
      break;
    case RewardType.SPELL:
      update.inventory!.spells = [
        ...playerData.inventory.spells,
        ...Array(quantity).fill(itemId),
      ].sort(numericalSort);
      break;
    case RewardType.EQUIPMENT:
      update.inventory!.equipment = [
        ...playerData.inventory.equipment,
        ...Array(quantity).fill(itemId),
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
