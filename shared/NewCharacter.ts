import {Class, Stat} from "./types";
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
    hp: number;
    mp: number;
    atk: number;
    def: number;
    spatk: number;
    spdef: number;
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
  hp: number;
  mp: number;
  atk: number;
  def: number;
  spatk: number;
  spdef: number;
  carrying_capacity: number;
  skill_slots: number;
  inventory: number[];
  skills: number[];

  constructor(characterClass = Class.RANDOM, level = 1) {
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
    this.hp = this.getHP();
    this.mp = this.getMP();
    this.atk = this.getAtk();
    this.def = this.getDef();
    this.spatk = this.getSpatk();
    this.spdef = this.getSpdef();

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
          this.hp = increaseStat(stat, this.hp, this.level, this.characterClass);
          break;
        case Stat.MP:
          this.mp = increaseStat(stat, this.mp, this.level, this.characterClass);
          break;
        case Stat.ATK:
          this.atk = increaseStat(stat, this.atk, this.level, this.characterClass);
          break;
        case Stat.DEF:
          this.def = increaseStat(stat, this.def, this.level, this.characterClass);
          break;
        case Stat.SPATK:
          this.spatk = increaseStat(stat, this.spatk, this.level, this.characterClass);
          break;
        case Stat.SPDEF:
          this.spdef = increaseStat(stat, this.spdef, this.level, this.characterClass);
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
      hp: this.hp,
      mp: this.mp,
      atk: this.atk,
      def: this.def,
      spatk: this.spatk,
      spdef: this.spdef,
      carrying_capacity: this.carrying_capacity,
      skill_slots: this.skill_slots,
      inventory: this.inventory,
      skills: this.skills,
    };
  }
}

