import {balanceCharacter, emptyAllocations} from '@legion/shared/characterBalance';
import {EquipmentSlot, equipmentSlotFields, InventoryActionType, InventoryType, ShopTab, statFieldsByIndex} from '@legion/shared/enums';
import {APICharacterData, Equipment, PlayerContextData, PlayerInventory} from '@legion/shared/interfaces';
import {getConsumableById} from '@legion/shared/Items';
import {getSpellById} from '@legion/shared/Spells';
import {getEquipmentById} from '@legion/shared/Equipments';
import {inventorySize} from '@legion/shared/utils';
import {
  canEquipConsumable, canEquipEquipment, canIncreaseStat, canLearnSpell, equipConsumable, equipEquipment,
  getSellPrice, learnSpell, numericalSort, unequipConsumable, unequipEquipment,
} from '@legion/shared/inventory';

// Client-side copies of the server mutations, built from the same shared helpers, so the
// interface can show their outcome before the server confirms it. Each returns null when the
// server would reject the action. Inputs are never mutated.

export interface PlayerView {
  player: PlayerContextData;
  characters: APICharacterData[];
}

function replaceCharacter(characters: APICharacterData[], character: APICharacterData) {
  return characters.map(c => c.id === character.id ? character : c);
}

/** Mirrors inventoryTransaction in api/functions/src/inventoryAPI.ts. */
export function predictInventoryAction(view: PlayerView, characterId: string, inventoryType: InventoryType,
    action: InventoryActionType, index: number, expectedItemId?: number): PlayerView | null {
  const source = view.characters.find(c => c.id === characterId);
  if (!source) return null;
  const player = {...view.player, inventory: structuredClone(view.player.inventory)};
  const character = structuredClone(source);
  for (const items of Object.values(player.inventory)) items.sort(numericalSort);

  const selected = action === InventoryActionType.UNEQUIP
    ? inventoryType === InventoryType.CONSUMABLES ? character.inventory[index]
      : inventoryType === InventoryType.EQUIPMENTS ? character.equipment[equipmentSlotFields[index as EquipmentSlot] as keyof Equipment] : undefined
    : player.inventory[inventoryType as keyof PlayerInventory]?.[index];
  if (typeof selected !== 'number' || selected < 0 || (expectedItemId !== undefined && selected !== expectedItemId)) return null;
  const article = inventoryType === InventoryType.CONSUMABLES ? getConsumableById(selected) :
    inventoryType === InventoryType.SPELLS ? getSpellById(selected) : getEquipmentById(selected);
  if (!article) return null;

  if (action === InventoryActionType.SELL) {
    const field = inventoryType as keyof PlayerInventory;
    player.inventory[field] = player.inventory[field].filter((_, i) => i !== index);
    return {player: {...player, gold: player.gold + getSellPrice(selected, inventoryType)}, characters: view.characters};
  }

  let update: {playerUpdate: Partial<PlayerContextData>; characterUpdate: Partial<APICharacterData>} | null = null;
  if (action === InventoryActionType.EQUIP) {
    if (inventoryType === InventoryType.CONSUMABLES && canEquipConsumable(character)) update = equipConsumable(player, character, index);
    else if (inventoryType === InventoryType.SPELLS && canLearnSpell(character, selected)) update = learnSpell(player, character, index);
    else if (inventoryType === InventoryType.EQUIPMENTS && canEquipEquipment(character, selected)) update = equipEquipment(player, character, index);
  } else if (action === InventoryActionType.UNEQUIP && inventorySize(player.inventory) < player.carrying_capacity) {
    if (inventoryType === InventoryType.CONSUMABLES) update = unequipConsumable(player, character, index);
    else if (inventoryType === InventoryType.EQUIPMENTS) update = unequipEquipment(player, character, index);
  }
  if (!update) return null;

  return {
    player: {...player, ...update.playerUpdate,
      engagementStats: {...view.player.engagementStats, ...update.playerUpdate.engagementStats}},
    characters: replaceCharacter(view.characters, balanceCharacter({...character, ...update.characterUpdate})),
  };
}

/** Mirrors changeSP in api/functions/src/characterAPI.ts: a spend, or a reset when stat is undefined. */
export function predictSP(view: PlayerView, characterId: string, stat?: number, amount?: number): PlayerView | null {
  const source = view.characters.find(c => c.id === characterId);
  if (!source) return null;
  const reset = stat === undefined;
  if (!reset && !canIncreaseStat(source, stat, amount)) return null;
  const allocations = reset ? emptyAllocations() : {...emptyAllocations(), ...source.sp_allocations};
  if (!reset) allocations[statFieldsByIndex[stat]] += amount;
  const character = balanceCharacter({...source, sp_allocations: allocations, spVersion: (source.spVersion ?? 0) + 1});
  return {
    player: reset ? view.player : {...view.player, engagementStats: {...view.player.engagementStats, everSpentSP: true}},
    characters: replaceCharacter(view.characters, character),
  };
}

/** Mirrors purchaseItem in api/functions/src/inventoryAPI.ts. */
export function predictItemPurchase(view: PlayerView, tab: ShopTab, itemId: number, quantity: number): PlayerView | null {
  const field = tab === ShopTab.CONSUMABLES ? 'consumables' : tab === ShopTab.SPELLS ? 'spells' : tab === ShopTab.EQUIPMENTS ? 'equipment' : undefined;
  const item = field === 'consumables' ? getConsumableById(itemId) : field === 'spells' ? getSpellById(itemId) : field ? getEquipmentById(itemId) : undefined;
  if (!item || !(item.price > 0)) return null;
  const {player} = view;
  const totalPrice = item.price * quantity;
  if (inventorySize(player.inventory) + quantity > player.carrying_capacity || player.gold < totalPrice) return null;
  return {
    player: {...player, gold: player.gold - totalPrice,
      inventory: {...player.inventory, [field]: [...player.inventory[field], ...Array(quantity).fill(itemId)].sort(numericalSort)},
      engagementStats: {...player.engagementStats, everPurchased: true}},
    characters: view.characters,
  };
}

/** Mirrors purchaseCharacter in api/functions/src/characterAPI.ts; the price is the one the shop listed. */
export function predictCharacterPurchase(view: PlayerView, recruit: APICharacterData, price: number, maxCharacters: number): PlayerView | null {
  if (view.characters.length >= maxCharacters || view.player.gold < price || view.characters.some(c => c.id === recruit.id)) return null;
  return {
    player: {...view.player, gold: view.player.gold - price},
    characters: [...view.characters, {...recruit, onSale: false, price: 0}],
  };
}
