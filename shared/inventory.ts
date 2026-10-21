import { APICharacterData, DBCharacterData, DBPlayerData, PlayerContextData, Equipment, EngagementStats, PlayerInventory } from './interfaces';

/** The player data the inventory helpers read and update. */
export interface InventoryHolder {
  inventory: PlayerInventory;
  engagementStats?: Partial<EngagementStats>;
}
import { EquipmentSlot, equipmentSlotFields, Class, ItemDialogType, InventoryType, statFieldsByIndex } from "./enums";
import { getSpellById } from "./Spells";
import { getEquipmentById } from "./Equipments";
import { inventorySize } from './utils';
import { getConsumableById } from './Items';
import { BASE_MAGE_SPELL_SLOTS, SKIP_LEVEL_RESTRICTIONS, SPELL_SLOT_UNLOCK_LEVELS } from './config';

const dev = process.env.NODE_ENV === "development";

export function numericalSort(a: number, b: number): number {
    return a - b;
}

export function roomInInventory(playerData: PlayerContextData | DBPlayerData): boolean {
    return inventorySize(playerData.inventory) < playerData.carrying_capacity;
}

export function ownConsumable(playerData: PlayerContextData | DBPlayerData, itemId: number): boolean {
  return playerData.inventory.consumables.includes(itemId);
}

export function ownSpell(playerData: PlayerContextData | DBPlayerData, itemId: number): boolean {
  return playerData.inventory.spells.includes(itemId);
}

export function ownEquipment(playerData: PlayerContextData | DBPlayerData, itemId: number): boolean {
  return playerData.inventory.equipment.includes(itemId);
}

export function canEquipConsumable(characterData: DBCharacterData | APICharacterData): boolean {
  return characterData.inventory.length <
    characterData.carrying_capacity + (characterData.carrying_capacity_bonus || 0);
}

/** Spell slots a class has at `level`: three for mages, plus one at each unlock level. */
export function spellSlotsAt(characterClass: Class, level: number): number {
  if (characterClass !== Class.WHITE_MAGE && characterClass !== Class.BLACK_MAGE) return 0;
  return BASE_MAGE_SPELL_SLOTS + SPELL_SLOT_UNLOCK_LEVELS.filter(unlock => level >= unlock).length;
}

/** A character's spell slots. Stored counts only ever add slots (older test accounts); levels grant the rest. */
export function spellSlots(characterData: Pick<DBCharacterData, 'class' | 'level' | 'skill_slots'>): number {
  return Math.max(characterData.skill_slots || 0, spellSlotsAt(characterData.class, characterData.level));
}

/** The level at which the next spell slot opens, or null once every slot is open. */
export function nextSpellSlotLevel(characterData: Pick<DBCharacterData, 'class' | 'level' | 'skill_slots'>): number | null {
  if (spellSlotsAt(characterData.class, 1) === 0) return null;
  return SPELL_SLOT_UNLOCK_LEVELS.find(unlock => characterData.level < unlock
    && spellSlotsAt(characterData.class, unlock) > spellSlots(characterData)) ?? null;
}

/** Class, level and not already known: whether the character could use the spell, slots aside. */
export function canKnowSpell(characterData: DBCharacterData | APICharacterData, spellId: number): boolean {
  const spell = getSpellById(spellId);
  if (!spell) {
    console.error("Invalid spell ID");
    return false;
  }
  if (dev) console.log(`[canKnowSpell] spellId: ${spellId}, spell: ${spell.name}, minLevel: ${spell.minLevel}, hasMinlevel: ${hasMinLevel(characterData, spell.minLevel)}, classes: ${spell.classes}, ${hasRequiredClass(characterData, spell.classes)}`);
  return hasMinLevel(characterData, spell.minLevel) &&
    hasRequiredClass(characterData, spell.classes) &&
    !(characterData.skills as number[]).includes(spellId);
}

export function canLearnSpell(characterData: DBCharacterData | APICharacterData, spellId: number): boolean {
  return canKnowSpell(characterData, spellId) && characterData.skills.length < spellSlots(characterData);
}

export function hasMinLevel(characterData: DBCharacterData | APICharacterData, level: number): boolean {
  // if (dev) console.log(`[hasMinLevel] level: ${level}, characterData.level: ${characterData.level}, SKIP_LEVEL_RESTRICTIONS: ${SKIP_LEVEL_RESTRICTIONS}`);
  return SKIP_LEVEL_RESTRICTIONS || characterData.level >= level;
}

export function hasRequiredClass(characterData: DBCharacterData | APICharacterData, classes: Class[]): boolean {
    return !classes.length || classes.includes(characterData.class);
}

export function canEquipEquipment(characterData: DBCharacterData | APICharacterData, equipmentId: number): boolean {
  const equipment = getEquipmentById(equipmentId);
  if (!equipment) {
    console.error("Invalid equipment ID");
    return false;
  }
  // if (dev) console.log(`[canEquipEquipment] equipmentId: ${equipmentId}, equipment: ${equipment.name}`);

  return hasRequiredClass(characterData, equipment.classes);
}

export function canIncreaseStat(characterData: DBCharacterData | APICharacterData, index: number, amount: number): boolean {
  if (!Number.isSafeInteger(index) || index < 0 || index >= statFieldsByIndex.length ||
      !Number.isSafeInteger(amount) || amount <= 0 || amount > characterData.sp) return false;
  // Any stat can take every point: the formulas already make one-stat builds a trade-off.
  return true;
}

export function equipConsumable(playerData: InventoryHolder, characterData: DBCharacterData | APICharacterData, index: number) {
  const playerInventory = playerData.inventory;
  const consumables = playerInventory.consumables.sort(numericalSort);
  const inventory = characterData.inventory as number[];

  if (index < 0 || index >= consumables.length) {
    return null;
  }

  const item = consumables[index];
  if (dev) console.log(`[equipConsumable] index: ${index}, item: ${item}, name: ${getConsumableById(item)?.name}`);
  consumables.splice(index, 1);
  inventory.push(item);

  playerInventory.consumables = consumables.sort(numericalSort);
  return {
    playerUpdate: {
      inventory: playerInventory,
      engagementStats: {
        ...playerData.engagementStats,
        everEquippedConsumable: true
      }
    },
    characterUpdate: { inventory },
  };
}

export function unequipConsumable(playerData: InventoryHolder, characterData: DBCharacterData | APICharacterData, index: number) {
  const playerInventory = playerData.inventory;
  const consumables = playerInventory.consumables.sort(numericalSort);
  const inventory = characterData.inventory as number[];

  if (index < 0 || index >= inventory.length) {
    return null;
  }

  const item = inventory[index];
  inventory.splice(index, 1);
  consumables.push(item);

  playerInventory.consumables = consumables.sort(numericalSort);
  return {
    playerUpdate: { inventory: playerInventory },
    characterUpdate: { inventory },
  };
}

/**
 * Teaching the scroll at `index` of the sorted player spells. With `replaceIndex`, the learned spell
 * in that slot returns to the inventory as a scroll and the new spell takes its place.
 */
export function learnSpell(playerData: InventoryHolder, characterData: DBCharacterData | APICharacterData, index: number, replaceIndex?: number) {
  const playerInventory = playerData.inventory;
  const spells = playerInventory.spells.sort(numericalSort);
  const skills = [...characterData.skills as number[]];

  if (index < 0 || index >= spells.length) {
    return null;
  }
  if (replaceIndex !== undefined && (!Number.isSafeInteger(replaceIndex) || replaceIndex < 0 || replaceIndex >= skills.length)) {
    return null;
  }

  const item = spells[index];
  if (skills.includes(item)) {
    return null;
  }

  spells.splice(index, 1);
  if (replaceIndex === undefined) skills.push(item);
  else spells.push(...skills.splice(replaceIndex, 1, item));

  playerInventory.spells = spells.sort(numericalSort);
  return {
    playerUpdate: {
      inventory: playerInventory,
      engagementStats: {
        ...playerData.engagementStats,
        everEquippedSpell: true
      }
    },
    characterUpdate: { skills },
  };
}

/** Returning the learned spell in slot `index` to the shared inventory as a scroll. */
export function unlearnSpell(playerData: InventoryHolder, characterData: DBCharacterData | APICharacterData, index: number) {
  const skills = [...characterData.skills as number[]];
  if (index < 0 || index >= skills.length) return null;
  const [spell] = skills.splice(index, 1);
  const playerInventory = playerData.inventory;
  playerInventory.spells = [...playerInventory.spells, spell].sort(numericalSort);
  return {
    playerUpdate: { inventory: playerInventory },
    characterUpdate: { skills },
  };
}

function handleInventoryCapacityChange(
  characterData: DBCharacterData | APICharacterData,
  playerInventory: PlayerInventory,
  newCapacity: number
): { characterInventory: number[], playerConsumables: number[] } {
  const characterInventory = [...characterData.inventory] as number[];
  const playerConsumables = [...playerInventory.consumables].sort(numericalSort);

  while (characterInventory.length > newCapacity) {
    const excess = characterInventory.pop();
    if (excess !== undefined) playerConsumables.push(excess);
  }

  return { characterInventory, playerConsumables };
}

export function equipEquipment(playerData: InventoryHolder, characterData: DBCharacterData | APICharacterData, index: number) {
  const playerInventory = playerData.inventory;
  const equipment = playerInventory.equipment.sort(numericalSort);
  const equipped = characterData.equipment as Equipment;
  let carrying_capacity_bonus = characterData.carrying_capacity_bonus;

  if (index < 0 || index >= equipment.length) {
    return null;
  }

  const item = equipment[index];
  equipment.splice(index, 1);

  const data = getEquipmentById(item);
  if (!data) {
    console.error("Invalid equipment ID");
    return null;
  }

  let slotNumber: number = data.slot;
  if (slotNumber === EquipmentSlot.LEFT_RING && equipped.left_ring !== -1) {
    slotNumber = EquipmentSlot.RIGHT_RING;
  }

  const field = equipmentSlotFields[slotNumber as EquipmentSlot];
  const currentlyEquipped = equipped[field as keyof Equipment];
  if (currentlyEquipped !== -1) {
    equipment.push(currentlyEquipped);
  }
  equipped[field as keyof Equipment] = item;

  if (slotNumber === EquipmentSlot.BELT) {
    carrying_capacity_bonus = data.beltSize || 0;
    const newCapacity = characterData.carrying_capacity + carrying_capacity_bonus;
    const { characterInventory, playerConsumables } = handleInventoryCapacityChange(
      characterData,
      playerInventory,
      newCapacity
    );
    playerInventory.consumables = playerConsumables;
    characterData.inventory = characterInventory;
  }

  playerInventory.equipment = equipment.sort(numericalSort);
  return {
    playerUpdate: {
      inventory: playerInventory,
      engagementStats: {
        ...playerData.engagementStats,
        everEquippedEquipment: true
      }
    },
    characterUpdate: {
      equipment: equipped,
      inventory: characterData.inventory,
      equipment_bonuses: applyEquipmentBonuses(equipped),
      carrying_capacity_bonus,
    },
  };
}

export function unequipEquipment(playerData: InventoryHolder, characterData: DBCharacterData | APICharacterData, index: number) {
  const playerInventory = playerData.inventory;
  const equipment = playerInventory.equipment.sort(numericalSort);
  const equipped = characterData.equipment as Equipment;
  let carrying_capacity_bonus = characterData.carrying_capacity_bonus;

  if (index < 0 || index >= Object.keys(equipmentSlotFields).length) {
    if (dev) console.log(`[unequipEquipment] invalid index: ${index} not in range 0-${Object.keys(equipmentSlotFields).length}`);
    return null;
  }

  const slotNumber: number = index;
  const field = equipmentSlotFields[slotNumber as EquipmentSlot];
  const item = equipped[field as keyof Equipment];

  if (item !== -1) {
    if (slotNumber === EquipmentSlot.BELT) {
      carrying_capacity_bonus = 0;
      const newCapacity = characterData.carrying_capacity;
      const { characterInventory, playerConsumables } = handleInventoryCapacityChange(
        characterData,
        playerInventory,
        newCapacity
      );
      playerInventory.consumables = playerConsumables;
      characterData.inventory = characterInventory;
    }
    equipped[field as keyof Equipment] = -1;
    equipment.push(item);
    playerInventory.equipment = equipment.sort(numericalSort);
  }

  return {
    playerUpdate: { inventory: playerInventory },
    characterUpdate: {
      equipment: equipped,
      equipment_bonuses: applyEquipmentBonuses(equipped),
      inventory: characterData.inventory,
      carrying_capacity_bonus
    },
  };
}

export function applyEquipmentBonuses(equipped: Equipment) {
  const bonuses = {
    hp: 0,
    mp: 0,
    atk: 0,
    def: 0,
    spatk: 0,
    spdef: 0,
    speed: 0,
  };
  for (const field of Object.values(equipmentSlotFields)) {
    const item = equipped[field as keyof Equipment];
    if (item !== -1) {
      const data = getEquipmentById(item);
      if (!data) {
        console.error("Invalid equipment ID");
        return bonuses;
      }
      data.effects.forEach((effect) => {
        switch (effect.stat) {
          case 0: bonuses.hp += effect.value; break;
          case 1: bonuses.mp += effect.value; break;
          case 2: bonuses.atk += effect.value; break;
          case 3: bonuses.def += effect.value; break;
          case 4: bonuses.spatk += effect.value; break;
          case 5: bonuses.spdef += effect.value; break;
          case 6: bonuses.speed += effect.value; break;
        }
      });
    }
  }
  return bonuses;
}

export function getSellPrice(itemId: number, type: ItemDialogType | InventoryType): number {
  switch (type) {
    case ItemDialogType.CONSUMABLES || InventoryType.CONSUMABLES:
      return Math.floor((getConsumableById(itemId)?.price || 0) / 2);
    case ItemDialogType.SPELLS || InventoryType.SPELLS:
      return Math.floor((getSpellById(itemId)?.price || 0) / 2);
    case ItemDialogType.EQUIPMENTS || InventoryType.EQUIPMENTS:
      return Math.floor((getEquipmentById(itemId)?.price || 0) / 2);
    default:
      return 0;
  }
}
