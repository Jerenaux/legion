import {INVENTORY_SIZE_PER_CHARACTER, MAX_CHARACTERS} from './config';
import {emptyAllocations} from './characterBalance';
import {getCharacterPrice} from './economy';
import {EquipmentSlot, equipmentSlotFields, InventoryActionType, InventoryType, ShopTab, statFieldsByIndex} from './enums';
import type {DBCharacterData, EngagementStats, Equipment, PlayerInventory} from './interfaces';
import {getConsumableById} from './Items';
import {getSpellById} from './Spells';
import {getEquipmentById} from './Equipments';
import {inventorySize} from './utils';
import {
  canEquipConsumable, canEquipEquipment, canIncreaseStat, canLearnSpell, equipConsumable, equipEquipment,
  getSellPrice, InventoryHolder, learnSpell, numericalSort, unequipConsumable, unequipEquipment,
} from './inventory';

// The rules of every player mutation, shared by the API handlers that apply them and the client
// that shows their outcome before the server confirms it. Functions never mutate their inputs.

/** Why an action cannot happen: the HTTP status the API answers with, and a player-facing message. */
export interface Rejection {
  status: number;
  error: string;
}

export function isRejection(value: unknown): value is Rejection {
  return typeof value === 'object' && value !== null && 'error' in value;
}

const reject = (status: number, error: string): Rejection => ({status, error});
/** Rejections the inventory API reports as `{status: 1}` rather than as an HTTP error. */
export const INVENTORY_ACTION_REFUSED = 'Unable to complete the request. Please try again.';

/** Player inventory capacity: slots for each owned character plus the slots bought in the Team menu. */
export function inventoryCapacity(ownedCharacters: number, purchasedSlots = 0): number {
  return ownedCharacters * INVENTORY_SIZE_PER_CHARACTER + purchasedSlots;
}

interface PlayerWallet extends InventoryHolder {
  gold: number;
}

const shopFields: Partial<Record<ShopTab, keyof PlayerInventory>> = {
  [ShopTab.CONSUMABLES]: 'consumables', [ShopTab.SPELLS]: 'spells', [ShopTab.EQUIPMENTS]: 'equipment',
};

function getArticle(field: keyof PlayerInventory | InventoryType, id: number) {
  return field === 'consumables' ? getConsumableById(id) : field === 'spells' ? getSpellById(id) :
    field === 'equipment' ? getEquipmentById(id) : undefined;
}

/** Buying `quantity` copies of a shop article. */
export function purchaseItem(player: PlayerWallet, capacity: number, tab: ShopTab, itemId: number, quantity: number)
    : Rejection | {gold: number; inventory: PlayerInventory} {
  if (!Number.isSafeInteger(itemId) || itemId < 0 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000) {
    return reject(400, 'Invalid purchase');
  }
  const field = shopFields[tab];
  const item = field && getArticle(field, itemId);
  if (!item || !Number.isFinite(item.price) || item.price <= 0) return reject(400, 'Invalid article');
  if (inventorySize(player.inventory) + quantity > capacity) return reject(409, 'Not enough room in inventory!');
  const totalPrice = item.price * quantity;
  if (player.gold < totalPrice) return reject(409, 'Not enough gold!');
  return {
    gold: player.gold - totalPrice,
    inventory: {...player.inventory, [field]: [...player.inventory[field], ...Array(quantity).fill(itemId)].sort(numericalSort)},
  };
}

/** Recruiting a character from the shop; the price depends on the roster size. */
export function recruitCharacter(player: {gold: number}, ownedCharacters: number, recruit: {onSale?: boolean} | undefined)
    : Rejection | {gold: number; price: number} {
  if (!recruit?.onSale) return reject(409, 'Character is not on sale');
  if (ownedCharacters >= MAX_CHARACTERS) return reject(409, 'Character limit reached!');
  const price = getCharacterPrice(ownedCharacters);
  if (player.gold < price) return reject(409, 'Not enough gold!');
  return {gold: player.gold - price, price};
}

export interface InventoryActionResult<C extends DBCharacterData = DBCharacterData> {
  inventory: PlayerInventory;
  goldGained: number;
  /** Engagement flags the action sets. */
  engagementStats: Partial<EngagementStats>;
  /** The updated character, or null when the action leaves it untouched (selling). */
  character: C | null;
}

/**
 * Equipping, unequipping or selling the item at `index`: an index into the sorted player inventory,
 * or for unequipping, into the character's items or equipment slots. `expectedItemId` guards against
 * an index that no longer points at the item the player chose.
 */
export function inventoryAction<C extends DBCharacterData>(player: PlayerWallet, capacity: number, source: C,
    inventoryType: InventoryType, action: InventoryActionType, index: number, expectedItemId?: number): Rejection | InventoryActionResult<C> {
  if (![InventoryType.CONSUMABLES, InventoryType.SPELLS, InventoryType.EQUIPMENTS].includes(inventoryType) ||
      ![InventoryActionType.EQUIP, InventoryActionType.UNEQUIP, InventoryActionType.SELL].includes(action) ||
      !Number.isSafeInteger(index) || index < 0) return reject(400, 'Invalid inventory action');
  const refused = reject(409, INVENTORY_ACTION_REFUSED);
  // Players see sorted inventories, including older documents stored unsorted.
  const owner = {...player, inventory: structuredClone(player.inventory)};
  for (const items of Object.values(owner.inventory)) items.sort(numericalSort);
  const character = structuredClone(source);
  const field = inventoryType as keyof PlayerInventory;

  const selected = action === InventoryActionType.UNEQUIP
    ? inventoryType === InventoryType.CONSUMABLES ? character.inventory[index]
      : inventoryType === InventoryType.EQUIPMENTS ? character.equipment[equipmentSlotFields[index as EquipmentSlot] as keyof Equipment] : undefined
    : owner.inventory[field][index];
  if (typeof selected !== 'number' || !Number.isSafeInteger(selected) || selected < 0 ||
      (expectedItemId !== undefined && selected !== expectedItemId) || !getArticle(inventoryType, selected)) return refused;

  if (action === InventoryActionType.SELL) {
    return {
      inventory: {...owner.inventory, [field]: owner.inventory[field].filter((_, i) => i !== index)},
      goldGained: getSellPrice(selected, inventoryType), engagementStats: {}, character: null,
    };
  }

  let update: {playerUpdate: {inventory: PlayerInventory; engagementStats?: Partial<EngagementStats>}; characterUpdate: Partial<DBCharacterData>} | null = null;
  if (action === InventoryActionType.EQUIP) {
    if (inventoryType === InventoryType.CONSUMABLES && canEquipConsumable(character)) update = equipConsumable(owner, character, index);
    else if (inventoryType === InventoryType.SPELLS && canLearnSpell(character, selected)) update = learnSpell(owner, character, index);
    else if (inventoryType === InventoryType.EQUIPMENTS && canEquipEquipment(character, selected)) update = equipEquipment(owner, character, index);
  } else if (inventorySize(owner.inventory) < capacity) {
    if (inventoryType === InventoryType.CONSUMABLES) update = unequipConsumable(owner, character, index);
    else if (inventoryType === InventoryType.EQUIPMENTS) update = unequipEquipment(owner, character, index);
  }
  if (!update) return refused;

  const flags = update.playerUpdate.engagementStats ?? {};
  return {
    inventory: update.playerUpdate.inventory,
    goldGained: 0,
    engagementStats: Object.fromEntries((['everEquippedConsumable', 'everEquippedSpell', 'everEquippedEquipment'] as const)
      .filter(flag => flags[flag]).map(flag => [flag, true])),
    character: {...character, ...update.characterUpdate},
  };
}

/**
 * Spending `amount` SP on the stat at `index`, or resetting every allocation. The result still
 * needs balanceCharacter to derive bonuses and remaining SP. `spVersion` is the build the request
 * was made from; older clients omit it.
 */
export function changeSP<C extends DBCharacterData>(character: C, reset: boolean, index?: number, amount?: number, spVersion?: number): Rejection | C {
  if (spVersion !== undefined && (!Number.isSafeInteger(spVersion) || spVersion < 0)) return reject(400, 'Invalid SP request');
  const allocations = reset ? emptyAllocations() : {...emptyAllocations(), ...character.sp_allocations};
  if (!reset) {
    if (index === undefined || amount === undefined || !Number.isSafeInteger(index) || index < 0 || index >= statFieldsByIndex.length ||
        !Number.isSafeInteger(amount) || amount <= 0) return reject(400, 'Invalid SP request');
    if (spVersion !== undefined && (character.spVersion ?? 0) !== spVersion) return staleBuild;
    if (!canIncreaseStat(character, index, amount)) return reject(409, 'Not enough SP or stat allocation limit reached');
    allocations[statFieldsByIndex[index]] += amount;
  } else if (spVersion !== undefined && (character.spVersion ?? 0) !== spVersion) return staleBuild;
  return {...character, sp_allocations: allocations, spVersion: (character.spVersion ?? 0) + 1};
}

const staleBuild = reject(409, 'This character changed elsewhere. Check the updated stats and try again.');
