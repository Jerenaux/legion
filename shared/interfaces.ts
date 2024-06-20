import { BaseEquipment } from "./BaseEquipment";
import { BaseItem } from "./BaseItem";
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectDirection, EquipmentSlot, Terrain, ChestColor, StatusEffect, Class } from "./enums";
import {ChestReward} from "@legion/shared/chests";

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
    num: number;
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
    chests: GameOutcomeReward[] ;
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

export interface DBPlayerData {
    name: string;
    gold: number;
    carrying_capacity: number;
    inventory: PlayerInventory;
    characters: any[];
    elo: number;
    league: number;
    lvl: number;
    dailyloot: DailyLootAllData;
    wins: number;
    losses: number;
    xp: number;
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

export interface GameOutcomeReward {
    color: ChestColor;
    content: ChestReward[];
}
export interface DBCharacterData {
    name: string;
    portrait: string;
    class: Class;
    level: number;
    xp: number;
    sp: number;
    allTimeSP: number;
    stats: CharacterStats;
    carrying_capacity: number;
    carrying_capacity_bonus: number;
    skill_slots: number;
    inventory: number[];
    equipment: Equipment;
    equipment_bonuses: CharacterStats;
    sp_bonuses: CharacterStats;
    skills: number[];
    onSale?: boolean;
    price?: number;
}

export interface APICharacterData extends DBCharacterData{
    id: string;
}

export interface PlayerNetworkData {
    frame: string;
    name: string;
    x: number;
    y: number;
    hp: number;
    maxHP: number;
    statuses: any;
    mp?: number;
    maxMP?: number;
    distance?: number;
    cooldown?: number;
    inventory?: number[];
    spells?: number[];
    xp?: number;
    class: Class;
    level: number;
}

export interface PlayerProfileData {
    teamName: string;
    playerName: string;
    playerLevel: number;
    playerRank: number;
    playerAvatar: string;
}
interface GamePlayerData {
    teamId: number;
    player: PlayerProfileData;
    team: PlayerNetworkData[];
}

export interface GameData {
    general: {
        reconnect: boolean;
        tutorial: boolean;
        spectator: boolean;
    },
    player: GamePlayerData,
    opponent: GamePlayerData,
    terrain: TerrainUpdate[],
}

export interface PlayerProps {
    name: string;
    number: number;
    portrait: string;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    cooldown: number;
    maxCooldown: number;
    spells: BaseSpell[];
    items: BaseItem[];
    casting: boolean;
    statuses: StatusEffects;
    pendingSpell: number;
}

export type StatusEffects = {
    [key in StatusEffect]: number;
}

export interface TeamMember {
  texture: string;
  name: string;
  hp: number;
  maxHP: number;
  mp: number;
  maxMP: number;
  isAlive: boolean;
  isPlayer: boolean;
  cooldown: number;
  totalCooldown: number;
  class: Class;
  statuses: StatusEffects;
}

export interface TeamOverview {
    members: TeamMember[];
    player: PlayerProfileData;
    score: number;
}