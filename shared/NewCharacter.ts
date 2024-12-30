import { Class, Stat, statFields } from "./enums";
import { CharacterStats, Equipment, DBCharacterData } from "./interfaces";
import { warriorSprites, whiteMageSprites, blackMageSprites, thiefSprites, femaleSprites }
  from "./sprites";
import { male_names, female_names } from "./names";
import { selectStatToLevelUp, increaseStat, getSPIncrement } from "./levelling";
import { getPrice } from "./economy";
import { getStarterConsumables, MAGE_SPECIFIC_ITEMS } from "./Items";

import { LOTSA_MP, BASE_CARRYING_CAPACITY, STARTING_WHITE_MAGE_SPELLS, STARTING_BLACK_MAGE_SPELLS } from "@legion/shared/config";
import { getSpellById, getSpellsUpToLevel } from "./Spells";

enum Gender {
  M,
  F
}
export class NewCharacter {
  name: string;
  gender: Gender;
  characterClass: Class;
  xp: number;
  level: number;
  portrait: string;
  stats: CharacterStats;
  equipment_bonuses: CharacterStats;
  sp_bonuses: CharacterStats;
  carrying_capacity: number;
  carrying_capacity_bonus: number;
  skill_slots: number;
  inventory: number[];
  equipment: Equipment;
  skills: number[];

  constructor(characterClass = Class.RANDOM, level = 1, unicornBonus = false, isAI = false) {
    console.log(`[NewCharacter:constructor] Creating new character with class ${characterClass}, level ${level}, unicornBonus ${unicornBonus}, isAI ${isAI}`);
    if (characterClass === Class.RANDOM) {
      const candidates = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
      // Get random value from candidates
      this.characterClass = candidates[
        Math.floor(Math.random() * candidates.length)
      ];
    } else {
      this.characterClass = characterClass;
    }

    this.portrait = this.getFrame();
    this.gender = this.determineGender();
    this.name = this.getName();
    this.xp = 0;
    this.level = level;
    this.carrying_capacity = BASE_CARRYING_CAPACITY;
    this.carrying_capacity_bonus = 0;
    this.skill_slots = this.getSkillSlots();
    this.inventory = [];
    this.equipment = {
      weapon: -1,
      armor: -1,
      helmet: -1,
      belt: -1,
      gloves: -1,
      boots: -1,
      left_ring: -1,
      right_ring: -1,
      necklace: -1,
    };
    this.skills = getSpells(this.characterClass, this.level, this.skill_slots, isAI);
    // console.log("========================");
    console.log(`[NewCharacter:constructor] AI spells: ${this.skills.map(spell => getSpellById(spell)?.name).join(", ")}`);
    // console.log("========================");
    this.stats = {
      [Stat.HP]: this.getHP() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      [Stat.MP]: this.getMP() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      [Stat.ATK]: this.getAtk() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      [Stat.DEF]: this.getDef() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      [Stat.SPATK]: this.getSpatk() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      [Stat.SPDEF]: this.getSpdef() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
    };
    this.equipment_bonuses = {
      [Stat.HP]: 0,
      [Stat.MP]: 0,
      [Stat.ATK]: 0,
      [Stat.DEF]: 0,
      [Stat.SPATK]: 0,
      [Stat.SPDEF]: 0,
    };
    this.sp_bonuses = {
      [Stat.HP]: 0,
      [Stat.MP]: 0,
      [Stat.ATK]: 0,
      [Stat.DEF]: 0,
      [Stat.SPATK]: 0,
      [Stat.SPDEF]: 0,
    };

    for (let i = 1; i < this.level; i++) {
      // console.log(`[NewCharacter:constructor] Stats before lvlUp: ${Object.values(this.stats).join(", ")}`);
      lvlUp(this.characterClass, this.stats);
      // console.log(`[NewCharacter:constructor] Stats after lvlUp: ${Object.values(this.stats).join(", ")}`);
    }

    if (isAI) {
      this.inventory = setUpInventory(this.characterClass, this.level, this.carrying_capacity);
      console.log(`[NewCharacter:constructor] AI inventory: ${this.inventory}`);
    }
  }

  getSkillSlots(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return 0;
      case Class.WHITE_MAGE:
        return 3;
      case Class.BLACK_MAGE:
        return 3;
      case Class.THIEF:
        return 1;
    }
    return 0;
  }

  determineGender(): Gender {
    if (femaleSprites.includes(this.portrait)) {
      return Gender.F;
    } else {
      return Gender.M;
    }
  }

  getName(): string {
    if (this.gender == Gender.M) {
      // Pick a random element of male_names
      return male_names[Math.floor(Math.random() * male_names.length)];
    } else {
      return female_names[Math.floor(Math.random() * female_names.length)];
    }
  }

  getFrame(): string {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return warriorSprites[Math.floor(Math.random() * warriorSprites.length)];
      case Class.WHITE_MAGE:
        return whiteMageSprites[
          Math.floor(Math.random() * whiteMageSprites.length)
        ];
      case Class.BLACK_MAGE:
        return blackMageSprites[
          Math.floor(Math.random() * blackMageSprites.length)
        ];
      case Class.THIEF:
        return thiefSprites[Math.floor(Math.random() * thiefSprites.length)];
    }
    return warriorSprites[Math.floor(Math.random() * warriorSprites.length)];
  }

  getHP(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return 100;
      case Class.WHITE_MAGE:
        return 80;
      case Class.BLACK_MAGE:
        return 80;
      case Class.THIEF:
        return 90;
    }
    return 100;
  }

  getMP(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return 20;
      case Class.WHITE_MAGE:
        return 30;
      case Class.BLACK_MAGE:
        return LOTSA_MP ? 1000 : 40;
      case Class.THIEF:
        return 20;
    }
    return 20;
  }

  getRandom(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  getAtk(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return this.getRandom(8, 12);
      case Class.WHITE_MAGE:
        return this.getRandom(5, 8);
      case Class.BLACK_MAGE:
        return this.getRandom(5, 8);
      case Class.THIEF:
        return this.getRandom(5, 10);
    }
    return 5;
  }

  getDef(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return this.getRandom(8, 12);
      case Class.WHITE_MAGE:
        return this.getRandom(5, 8);
      case Class.BLACK_MAGE:
        return this.getRandom(5, 8);
      case Class.THIEF:
        return this.getRandom(5, 10);
    }
    return 5;
  }

  getSpatk(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return this.getRandom(5, 8);
      case Class.WHITE_MAGE:
        return this.getRandom(8, 12);
      case Class.BLACK_MAGE:
        return this.getRandom(8, 12);
      case Class.THIEF:
        return this.getRandom(5, 8);
    }
    return 5;
  }

  getSpdef(): number {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return this.getRandom(5, 8);
      case Class.WHITE_MAGE:
        return this.getRandom(8, 12);
      case Class.BLACK_MAGE:
        return this.getRandom(8, 12);
      case Class.THIEF:
        return this.getRandom(5, 8);
    }
    return 5;
  }

  getPrice(): number {
    const reference = 135;
    // Returns the sum of all stats
    const sum = Object.values(this.stats).reduce((a, b) => a + b, 0);
    const coefficient = sum / reference;
    const price = Math.floor(getPrice(100) * coefficient);
    // Add +- 10% random variation
    return price + Math.floor(Math.random() * price * 0.2);
  }

  getCharacterData(includePrice = false): DBCharacterData {
    // Convert stats from enum keys to string keys for DB storage
    const validStats = statFields.filter(key => 
        Stat[key.toUpperCase() as keyof typeof Stat] !== Stat.NONE
    );

    const dbStats = Object.fromEntries(
        // @ts-ignore: Stat indexing is actually safe here
        validStats.map(key => [key, this.stats[Stat[key.toUpperCase() as keyof typeof Stat]]])
    );
    const dbEquipmentBonuses = Object.fromEntries(
        // @ts-ignore: Stat indexing is actually safe here
        validStats.map(key => [key, this.equipment_bonuses[Stat[key.toUpperCase() as keyof typeof Stat]]])
    );
    const dbSpBonuses = Object.fromEntries(
        // @ts-ignore: Stat indexing is actually safe here
        validStats.map(key => [key, this.sp_bonuses[Stat[key.toUpperCase() as keyof typeof Stat]]])
    );

    const data: DBCharacterData = {
        name: this.name,
        portrait: this.portrait,
        class: this.characterClass,
        level: this.level,
        xp: 0,
        sp: 0,
        allTimeSP: 0,
        stats: dbStats,
        carrying_capacity: this.carrying_capacity,
        carrying_capacity_bonus: this.carrying_capacity_bonus,
        skill_slots: this.skill_slots,
        inventory: this.inventory,
        equipment: this.equipment,
        equipment_bonuses: dbEquipmentBonuses,
        sp_bonuses: dbSpBonuses,
        skills: this.skills
    };
    if (includePrice) {
        data.price = this.getPrice();
    }
    return data;
  }
}

export function getSpells(characterClass: Class, level: number, skill_slots: number, isAI = false): number[] {
  let spells = getSpellsUpToLevel(characterClass, level);
  // console.log(`[getSpells] Candidate spells up to level ${level}: ${spells.join(", ")}`);
  switch (characterClass) {
    case Class.WARRIOR:
      return [];
    case Class.WHITE_MAGE:
      if (!isAI) return STARTING_WHITE_MAGE_SPELLS;
      // Remove spells that are already in STARTING_WHITE_MAGE_SPELLS
      spells = spells.filter(spell => !STARTING_WHITE_MAGE_SPELLS.includes(spell));
      // Select `skill_slots` random spells from spells
      return STARTING_WHITE_MAGE_SPELLS.concat(spells.sort(() => Math.random() - 0.5).slice(0, skill_slots - STARTING_WHITE_MAGE_SPELLS.length ));
    case Class.BLACK_MAGE:
      if (!isAI) return STARTING_BLACK_MAGE_SPELLS;
      // Remove spells that are already in STARTING_BLACK_MAGE_SPELLS
      spells = spells.filter(spell => !STARTING_BLACK_MAGE_SPELLS.includes(spell));
      // console.log(`[getSpells] Black mage spells: ${spells.map(spell => `${getSpellById(spell)?.name} (${getSpellById(spell)?.minLevel})`).join(", ")}`);
      // Select `skill_slots` random spells from spells
      const randomSpells = spells.sort(() => Math.random() - 0.5).slice(0, skill_slots - STARTING_BLACK_MAGE_SPELLS.length );
      // console.log(`[getSpells] starting spells: ${STARTING_BLACK_MAGE_SPELLS.map(spell => `${getSpellById(spell)?.name} (${getSpellById(spell)?.minLevel})`).join(", ")}`);
      // console.log(`[getSpells] Random spells: ${randomSpells.map(spell => `${getSpellById(spell)?.name} (${getSpellById(spell)?.minLevel})`).join(", ")}`);
      const result = STARTING_BLACK_MAGE_SPELLS.concat(randomSpells);
      // console.log(`[getSpells] Result: ${result.map(spell => `${getSpellById(spell)?.name} (${getSpellById(spell)?.minLevel})`).join(", ")}`);
      return result;
    case Class.THIEF:
      return [];
  }
  return [];
}

export function setUpInventory(characterClass: Class, level: number, carrying_capacity: number): number[] {
  const inventory: number[] = [];
  let consumables = getStarterConsumables(level / 2);
  if (consumables.length === 0) return [];

  // If the character is not a mage, filter out mage specific items
  if (characterClass !== Class.WHITE_MAGE && characterClass !== Class.BLACK_MAGE) {
    consumables = consumables.filter(item => !MAGE_SPECIFIC_ITEMS.includes(item));
  }

  // For each available slot, add a random consumable or possibly nothing
  for (let i = 0; i < carrying_capacity; i++) {
    if (Math.random() < 0.6) {
      // Pick a random consumable
      inventory.push(consumables[Math.floor(Math.random() * consumables.length)]);
    }
  }
  return inventory;
}

export function lvlUp(characterClass: Class, stats: CharacterStats): void {
  const NB_INCREASES = 2;
  for (let i = 0; i < NB_INCREASES; i++) {
    const stat = selectStatToLevelUp(characterClass);
    switch (stat) {
      case Stat.HP:
        stats[Stat.HP] = increaseStat(stat, stats[Stat.HP]);
        break;
      case Stat.MP:
        stats[Stat.MP] = increaseStat(stat, stats[Stat.MP]);
        break;
      case Stat.ATK:
        stats[Stat.ATK] = increaseStat(stat, stats[Stat.ATK]);
        break;
      case Stat.DEF:
        stats[Stat.DEF] = increaseStat(stat, stats[Stat.DEF]);
        break;
      case Stat.SPATK:
        stats[Stat.SPATK] = increaseStat(stat, stats[Stat.SPATK]);
        break;
      case Stat.SPDEF:
        stats[Stat.SPDEF] = increaseStat(stat, stats[Stat.SPDEF]);
        break;
    }
  }
}