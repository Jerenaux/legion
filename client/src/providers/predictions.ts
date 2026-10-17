import {balanceCharacter} from '@legion/shared/characterBalance';
import {InventoryActionType, InventoryType, ShopTab} from '@legion/shared/enums';
import {APICharacterData, PlayerContextData} from '@legion/shared/interfaces';
import {
  changeSP, inventoryAction, inventoryCapacity, isRejection, purchaseItem, recruitCharacter, Rejection,
} from '@legion/shared/playerActions';

// The outcome of each player mutation, computed with the same shared rules the API applies, so
// the interface can show it before the server confirms. A Rejection carries the server's reason.

export interface PlayerView {
  player: PlayerContextData;
  characters: APICharacterData[];
}

const notOwned: Rejection = {status: 403, error: 'Character not owned by player'};

function replaceCharacter(characters: APICharacterData[], character: APICharacterData) {
  return characters.map(c => c.id === character.id ? character : c);
}

export function predictInventoryAction(view: PlayerView, characterId: string, inventoryType: InventoryType,
    action: InventoryActionType, index: number, expectedItemId?: number): PlayerView | Rejection {
  const character = view.characters.find(c => c.id === characterId);
  if (!character) return notOwned;
  // The client receives the capacity the API checks against (playerInventoryCapacity).
  const outcome = inventoryAction(view.player, view.player.carrying_capacity, character, inventoryType, action, index, expectedItemId);
  if (isRejection(outcome)) return outcome;
  return {
    player: {...view.player, inventory: outcome.inventory, gold: view.player.gold + outcome.goldGained,
      engagementStats: {...view.player.engagementStats, ...outcome.engagementStats}},
    characters: outcome.character ? replaceCharacter(view.characters, balanceCharacter(outcome.character)) : view.characters,
  };
}

/** A spend, or a reset when `stat` is undefined. */
export function predictSP(view: PlayerView, characterId: string, stat?: number, amount?: number): PlayerView | Rejection {
  const character = view.characters.find(c => c.id === characterId);
  if (!character) return notOwned;
  const reset = stat === undefined;
  const outcome = changeSP(character, reset, stat, amount, character.spVersion ?? 0);
  if (isRejection(outcome)) return outcome;
  return {
    player: reset ? view.player : {...view.player, engagementStats: {...view.player.engagementStats, everSpentSP: true}},
    characters: replaceCharacter(view.characters, balanceCharacter(outcome)),
  };
}

export function predictItemPurchase(view: PlayerView, tab: ShopTab, itemId: number, quantity: number): PlayerView | Rejection {
  const outcome = purchaseItem(view.player, view.player.carrying_capacity, tab, itemId, quantity);
  if (isRejection(outcome)) return outcome;
  return {
    player: {...view.player, ...outcome, engagementStats: {...view.player.engagementStats, everPurchased: true}},
    characters: view.characters,
  };
}

export function predictCharacterPurchase(view: PlayerView, recruit: APICharacterData): PlayerView | Rejection {
  const owned = view.characters.length;
  const outcome = recruitCharacter(view.player, owned, recruit);
  if (isRejection(outcome)) return outcome;
  return {
    // Each character brings its own inventory slots.
    player: {...view.player, gold: outcome.gold,
      carrying_capacity: view.player.carrying_capacity + inventoryCapacity(owned + 1) - inventoryCapacity(owned)},
    characters: [...view.characters, {...recruit, onSale: false, price: 0}],
  };
}
