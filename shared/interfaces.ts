import { Stat, Target, EffectDirection, EquipmentSlot, Terrain, Rarity, StatusEffect } from "./enums";

export class EffectModifier {
    stat;
    value;
    direction;

    constructor(stat: Stat, value: number, direction: EffectDirection) {
        this.stat = stat;
        this.value = value;
        this.direction = direction;
    }
}

export class EffectModifiers {
    casterModifier;
    targetModifier;

    constructor(casterModifier: EffectModifier, targetModifier: EffectModifier) {
        this.casterModifier = casterModifier;
        this.targetModifier = targetModifier;
    }
}

export interface Effect {
    stat: Stat;
    value: number;
    modifiers?: EffectModifiers;
    onKO?: boolean;
}


export interface SpellData {
    id: number;
    name: string;
    description: string;
    frame: string;
    sfx: string;
    animation: string;
    cooldown: number;
    castTime: number;
    cost: number;
    target: Target;
    size: number;
    effects: Effect[];
    shake: boolean;
    score: number;
    yoffset?: number;
    terrain?: Terrain;
    rarity: Rarity;
    status?: StatusEffectData;
}

export interface ConsumableData {
    id: number;
    name: string;
    description: string;
    frame: string;
    sfx: string;
    animation: string;
    cooldown: number;
    target: Target;
    size: number;
    effects: Effect[];
    price: number;
    rarity: Rarity;
}

export interface EquipmentData {
    id: number;
    name: string;
    description: string;
    frame: string;
    effects: Effect[];
    slot: EquipmentSlot,
    price: number;
    rarity: Rarity;
    beltSize?: number;
}

export interface CharacterUpdate {
    id: string;
    points: number;
    xp: number;
    level: number;
}
export interface OutcomeData {
    isWinner: boolean;
    xp: number;
    gold: number;
    characters?: CharacterUpdate[];
    elo: number;
    chestsRewards: any;
}

export interface CharacterStats {
    hp: number;
    mp: number;
    atk: number;
    def: number;
    spatk: number;
    spdef: number;
}


export interface Equipment {
    weapon: number;
    armor: number;
    helmet: number;
    belt: number;
    gloves: number;
    boots: number;
    left_ring: number;
    right_ring: number;
    necklace: number;
  }

export interface TerrainUpdate {
    x: number;
    y: number;
    terrain: Terrain;
}

export interface StatusEffectData {
    effect: StatusEffect;
    duration: number;
    chance: number;
}

export interface ChestsData {
    bronze: ChestData;
    silver: ChestData;
    gold: ChestData;
}

export interface ChestData {
    hasKey: boolean;
    time: number;
}

export interface ChestsKeysData {
    bronze: boolean;
    silver: boolean;
    gold: boolean;
}