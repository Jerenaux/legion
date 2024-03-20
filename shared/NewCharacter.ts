import {Class, Stat} from "./enums";
import { CharacterStats } from "./interfaces";
import {warriorSprites, whiteMageSprites, blackMageSprites, thiefSprites}
  from "./sprites";
import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";
import {selectStatToLevelUp, increaseStat} from "./levelling";

interface CharacterData {
    name: string;
    portrait: string;
    class: Class;
    level: number;
    xp: number;
    sp: number;
    allTimeSP: number;
    stats: CharacterStats;
    carrying_capacity: number;
    skill_slots: number;
    inventory: number[];
    skills: number[];
    onSale?: boolean;
    price?: number;
}

export class NewCharacter {
  name: string;
  characterClass: Class;
  xp: number
  level: number;
  portrait: string;
  stats: CharacterStats;
  carrying_capacity: number;
  skill_slots: number;
  inventory: number[];
  skills: number[];

  constructor(characterClass = Class.RANDOM, level = 1) {
    // console.log(`Creating new character of class ${Class[characterClass]} and level ${level}`);
    const nameOpts = {dictionaries: [adjectives, colors, animals], length: 2};

    this.name = uniqueNamesGenerator(nameOpts);
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
    this.xp = 0;
    this.level = level;
    this.carrying_capacity = 3;
    this.skill_slots = this.getSkillSlots();
    this.inventory = [];
    this.skills = this.getSkills();
    this.stats = {
      hp: this.getHP(),
      mp: this.getMP(),
      atk: this.getAtk(),
      def: this.getDef(),
      spatk: this.getSpatk(),
      spdef: this.getSpdef(),
    }

    for (let i = 1; i < level; i++) {
      this.lvlUp();
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

  getSkills(): number[] {
    switch (this.characterClass) {
      case Class.WARRIOR:
        return [];
      case Class.WHITE_MAGE:
        return [1];
      case Class.BLACK_MAGE:
        return [0, 2, 3];
      case Class.THIEF:
        return [];
      }
      return [];
  }

  getCharacterData(): CharacterData {
    return {
      name: this.name,
      portrait: this.portrait,
      class: this.characterClass,
      level: this.level,
      xp: 0,
      sp: 0,
      allTimeSP: 0,
      stats: this.stats,
      carrying_capacity: this.carrying_capacity,
      skill_slots: this.skill_slots,
      inventory: this.inventory,
      skills: this.skills,
    };
  }
}

