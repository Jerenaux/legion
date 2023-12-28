import {Class} from "@legion/shared/types";
import {uniqueNamesGenerator, adjectives, colors, animals}
  from "unique-names-generator";

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
}

export class NewCharacter {
  characterClass: Class;

  constructor() {
    this.characterClass = Math.floor(Math.random() * 3) as Class;
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
  }

  getFrame(): string {
    const warriorFrames = [
      "1_1", "1_2", "1_3", "1_4", "2_1", "2_2", "2_6", "2_7", "3_1", "3_6",
      "3_8", "4_7", "4_8", "5_1", "5_2", "5_4", "6_8", "7_4", "mil1_7",
      "mil1_8",
    ];
    const whiteMageFrames = [
      "1_7", "1_8", "2_8", "3_3", "4_6", "5_6", "6_4", "7_7",
    ];
    const blackMageFrames = [
      "1_5", "1_6", "2_3", "3_2", "4_3", "3_5", "4_5", "5_5", "5_7", "7_6",
    ];
    const thiefFrames = [
      "2_4", "2_5", "3_4", "3_7", "4_2", "5_3", "6_1", "6_2", "6_7",
    ];
    switch (this.characterClass) {
    case Class.WARRIOR:
      return warriorFrames[Math.floor(Math.random() * warriorFrames.length)];
    case Class.WHITE_MAGE:
      return whiteMageFrames[
        Math.floor(Math.random() * whiteMageFrames.length)
      ];
    case Class.BLACK_MAGE:
      return blackMageFrames[
        Math.floor(Math.random() * blackMageFrames.length)
      ];
    case Class.THIEF:
      return thiefFrames[Math.floor(Math.random() * thiefFrames.length)];
    }
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
  }

  generateCharacterData(): CharacterData {
    return {
      name: uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        length: 2,
      }),
      portrait: this.getFrame(),
      class: this.characterClass,
      level: 1,
      xp: 0,
      hp: this.getHP(),
      mp: this.getMP(),
      atk: this.getAtk(),
      def: this.getDef(),
      spatk: this.getSpatk(),
      spdef: this.getSpdef(),
      carrying_capacity: 3,
      skill_slots: this.getSkillSlots(),
      inventory: [],
      skills: [],
    };
  }
}

