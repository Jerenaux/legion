import { BaseEquipment } from "./BaseEquipment";
import { BaseItem } from "./BaseItem";
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectDirection, EquipmentSlot, Terrain, ChestColor, StatusEffect, Class } from "./enums";

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
    frame: number;
    sfx: string;
    vfx: string;
    cooldown?: number;
    castTime?: number;
    cost?: number;
    target: Target;
    size: number;
    effects: Effect[];
    shake: boolean;
    score: number;
    yoffset?: number;
    scale?: number;
    terrain?: Terrain;
    minLevel?: number;
    classes?: Class[];
    status?: StatusEffectData;
    effort: number;
}

export interface ConsumableData {
    id: number;
    name: string;
    description: string;
    frame: number;
    sfx: string;
    animation: string;
    cooldown: number;
    target: Target;
    size: number;
    effects: Effect[];
    effort: number;
}

export interface EquipmentData {
    id: number;
    name: string;
    description: string;
    frame: number;
    effects: Effect[];
    slot: EquipmentSlot,
    minLevel?: number;
    classes?: Class[];
    beltSize?: number;
    effort: number;
}

export interface CharacterUpdate {
    id: string;
    points: number;
    xp: number;
    level: number;
}
export interface OutcomeData {
    isWinner: boolean;
    grade: string;
    xp: number;
    gold: number;
    characters?: CharacterUpdate[];
    elo: number;
    key: ChestColor;
    chests: any;
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

export interface PlayerInventory {
    consumables: number[];
    spells: number[];
    equipment: number[];
}

export interface ShopItems {
    consumables: BaseItem[];
    spells: BaseSpell[];
    equipment: BaseEquipment[];
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

export interface ChestsTimeData {
    bronze: ChestTimeData;
    silver: ChestTimeData;
    gold: ChestTimeData;
}

export interface ChestTimeData {
    hasKey: boolean;
    time: number;
}

export interface DailyLootAllData {
    [ChestColor.BRONZE]: DailyLootData;
    [ChestColor.SILVER]: DailyLootData;
    [ChestColor.GOLD]: DailyLootData;
}

export interface DailyLootData {
    hasKey: boolean;
    countdown?: number;
    time?: number;
}

export interface APIPlayerData {
    gold: number;
    elo: number;
    league: number;
    lvl: number;
    name: string;
    teamName: string;
    avatar: string;
    rank: number;
    dailyloot: DailyLootAllData;
}

export interface TeamData {
    elo: number;
    lvl: number;
    playerName: string;
    teamName: string;
    avatar: string;
    league: number;
    rank: number;
    dailyloot: DailyLootAllData;
}