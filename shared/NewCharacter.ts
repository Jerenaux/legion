import {Class, Stat} from "./enums";
import { CharacterStats, Equipment, DBCharacterData } from "./interfaces";
import {warriorSprites, whiteMageSprites, blackMageSprites, thiefSprites, femaleSprites}
  from "./sprites";
import { male_names, female_names } from "./names";
import {selectStatToLevelUp, increaseStat} from "./levelling";
import { getPrice } from "./economy";
import { getStarterSpells } from "./Spells";
import { getStarterConsumables } from "./Items";

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
    this.carrying_capacity = 3;
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
    this.skills = this.getSpells();
    this.stats = {
      hp: this.getHP() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      mp: this.getMP() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      atk: this.getAtk() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      def: this.getDef() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      spatk: this.getSpatk() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
      spdef: this.getSpdef() * (unicornBonus && Math.random() < 0.1 ? 2 : 1),
    };
    this.equipment_bonuses = {
      hp: 0,
      mp: 0,
      atk: 0,
      def: 0,
      spatk: 0,
      spdef: 0,
    };
    this.sp_bonuses = {
      hp: 0,
      mp: 0,
      atk: 0,
      def: 0,
      spatk: 0,
      spdef: 0,
    };

    for (let i = 1; i < this.level; i++) {
      this.lvlUp();
    }

    if (isAI) {
      this.setUpInventory();
    }
  }

  lvlUp(): void {
    const NB_INCREASES = 2;
    for (let i = 0; i < NB_INCREASES; i++) {
      const stat = selectStatToLevelUp(this.characterClass);
      switch (stat) {
        case Stat.HP:
          this.stats.hp = increaseStat(stat, this.stats.hp, this.level, this.characterClass);
          break;
        case Stat.MP:
          this.stats.mp = increaseStat(stat, this.stats.mp, this.level, this.characterClass);
          break;
        case 2:
          this.stats.atk = increaseStat(stat, this.stats.atk, this.level, this.characterClass);
          break;
        case Stat.DEF:
          this.stats.def = increaseStat(stat, this.stats.def, this.level, this.characterClass);
          break;
        case Stat.SPATK:
          this.stats.spatk = increaseStat(stat, this.stats.spatk, this.level, this.characterClass);
          break;
        case Stat.SPDEF:
          this.stats.spdef = increaseStat(stat, this.stats.spdef, this.level, this.characterClass);
          break;
      }
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
      return 40;
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

  getSpells(): number[] {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return [];
      case Class.WHITE_MAGE:
      case Class.BLACK_MAGE: {
          const starterSpells = getStarterSpells(this.characterClass);
          return [starterSpells[Math.floor(Math.random() * starterSpells.length)]];
      }
      case Class.THIEF:
        return [];
      }
      return [];
  }

  setUpInventory() {
    const consumables = getStarterConsumables(this.level/2);
    console.log(`[NewCharacter:setUpInventory] Consumables for AI ${this.name}: ${consumables}`);
    if (consumables.length === 0) return;
    // For each available slot, add a random consumable or possibly nothing
    for (let i = 0; i < this.carrying_capacity; i++) {
      if (Math.random() < 0.6) {
        // Pick a random consumable
        this.inventory.push(consumables[Math.floor(Math.random() * consumables.length)]);
      }
    }
    console.log(`[NewCharacter:setUpInventory] Inventory for AI ${this.name}: ${this.inventory} (length: ${this.inventory.length})`);
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
    const data: DBCharacterData = {
      name: this.name,
      portrait: this.portrait,
      class: this.characterClass,
      level: this.level,
      xp: 0,
      sp: 0,
      allTimeSP: 0,
      stats: this.stats,
      carrying_capacity: this.carrying_capacity,
      carrying_capacity_bonus: this.carrying_capacity_bonus,
      skill_slots: this.skill_slots,
      inventory: this.inventory,
      equipment: this.equipment,
      equipment_bonuses: this.equipment_bonuses,
      sp_bonuses: this.sp_bonuses,
      skills: this.skills
    };
    if (includePrice) {
      data.price = this.getPrice();
    }
    return data;
  }
}

