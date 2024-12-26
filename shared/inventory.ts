import { APICharacterData, DBCharacterData, DBPlayerData, PlayerContextData, Equipment } from './interfaces';
import { EquipmentSlot, equipmentSlotFields, Class, ItemDialogType, InventoryType } from "./enums";
import { getSpellById } from "./Spells";
import { getEquipmentById } from "./Equipments";
import { inventorySize } from '@legion/shared/utils';
import { getConsumableById } from './Items';
import { SKIP_LEVEL_RESTRICTIONS } from '@legion/shared/config';

const dev = process.env.NODE_ENV === "development";

export function numericalSort(a: number, b: number): number {
    return a - b;
}

export function roomInInventory(playerData: PlayerContextData | DBPlayerData): boolean {
    return inventorySize(playerData.inventory) < playerData.carrying_capacity;
}

export function canEquipConsumable(characterData: DBCharacterData | APICharacterData): boolean {
  return characterData.inventory.length <
    characterData.carrying_capacity + (characterData.carrying_capacity_bonus || 0);
}

export function canLearnSpell(characterData: DBCharacterData | APICharacterData, spellId: number): boolean {
  const spell = getSpellById(spellId);
  if (!spell) {
    console.error("Invalid spell ID");
    return false;
  }
  if (dev) console.log(`[canLearnSpell] spellId: ${spellId}, spell: ${spell.name}, minLevel: ${spell.minLevel}, hasMinlevel: ${hasMinLevel(characterData, spell.minLevel)}, classes: ${spell.classes}, ${hasRequiredClass(characterData, spell.classes)}`);
  return (
    hasMinLevel(characterData, spell.minLevel) &&
    hasRequiredClass(characterData, spell.classes) &&
    characterData.skills.length < characterData.skill_slots
  );
}

export function hasMinLevel(characterData: DBCharacterData | APICharacterData, level: number): boolean {
  if (dev) console.log(`[hasMinLevel] level: ${level}, characterData.level: ${characterData.level}, SKIP_LEVEL_RESTRICTIONS: ${SKIP_LEVEL_RESTRICTIONS}`);
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
  if (dev) console.log(`[canEquipEquipment] equipmentId: ${equipmentId}, equipment: ${equipment.name}`);

  return (
    hasMinLevel(characterData, equipment.minLevel) &&
    hasRequiredClass(characterData, equipment.classes)
  );
}

export function equipConsumable(playerData: PlayerContextData | DBPlayerData, characterData: DBCharacterData | APICharacterData, index: number) {
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
    playerUpdate: { inventory: playerInventory },
    characterUpdate: { inventory },
  };
}

export function unequipConsumable(playerData: PlayerContextData | DBPlayerData, characterData: DBCharacterData | APICharacterData, index: number) {
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

export function learnSpell(playerData: PlayerContextData | DBPlayerData, characterData: DBCharacterData | APICharacterData, index: number) {
  const playerInventory = playerData.inventory;
  const spells = playerInventory.spells.sort(numericalSort);
  const skills = characterData.skills as number[];

  if (index < 0 || index >= spells.length) {
    return null;
  }

  const item = spells[index];
  if (skills.includes(item)) {
    return null;
  }

  spells.splice(index, 1);
  skills.push(item);

  playerInventory.spells = spells.sort(numericalSort);
  return {
    playerUpdate: { inventory: playerInventory },
    characterUpdate: { skills },
  };
}

function handleInventoryCapacityChange(
  characterData: DBCharacterData | APICharacterData,
  playerInventory: PlayerContextData['inventory'] | DBPlayerData['inventory'],
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

export function equipEquipment(playerData: PlayerContextData | DBPlayerData, characterData: DBCharacterData | APICharacterData, index: number) {
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
  if (slotNumber == EquipmentSlot.LEFT_RING && equipped.left_ring !== -1) {
    slotNumber = EquipmentSlot.RIGHT_RING;
  }

  const field = equipmentSlotFields[slotNumber as EquipmentSlot];
  const currentlyEquipped = equipped[field as keyof Equipment];
  if (currentlyEquipped != -1) {
    equipment.push(currentlyEquipped);
  }
  equipped[field as keyof Equipment] = item;

  if (slotNumber == EquipmentSlot.BELT) {
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
    playerUpdate: { inventory: playerInventory },
    characterUpdate: {
      equipment: equipped,
      inventory: characterData.inventory,
      equipment_bonuses: applyEquipmentBonuses(equipped),
      carrying_capacity_bonus,
    },
  };
}

export function unequipEquipment(playerData: PlayerContextData | DBPlayerData, characterData: DBCharacterData | APICharacterData, index: number) {
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

  if (item != -1) {
    if (slotNumber == EquipmentSlot.BELT) {
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

function applyEquipmentBonuses(equipped: Equipment) {
  const bonuses = {
    hp: 0,
    mp: 0,
    atk: 0,
    def: 0,
    spatk: 0,
    spdef: 0,
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