// When adding stats, also update applyEquipmentBonuses()
export enum Stat {
    HP,
    MP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    SPEED,
    NONE
}


export const StatFields = {
    [Stat.HP]: 'hp',
    [Stat.MP]: 'mp',
    [Stat.ATK]: 'atk',
    [Stat.DEF]: 'def',
    [Stat.SPATK]: 'spatk',
    [Stat.SPDEF]: 'spdef',
    [Stat.SPEED]: 'speed'
}

export const statFieldsByIndex = Object.values(StatFields);

export const StatLabels = {
    [Stat.HP]: 'HP',
    [Stat.MP]: 'MP',
    [Stat.ATK]: 'ATK',
    [Stat.DEF]: 'DEF',
    [Stat.SPATK]: 'SP.ATK',
    [Stat.SPDEF]: 'SP.DEF',
    [Stat.SPEED]: 'SPEED'
}

export enum STATS_BG_COLOR {
    HP = '#628c27',
    MP = '#1f659a',
    ATK = '#9a1f3c',
    DEF = '#cc872d',
    'SP.ATK' = '#26846b',
    'SP.DEF' = '#703fba',
    SPEED = '#c4317c',
}

export enum Target {
    SELF,
    AOE,
    SINGLE
}

export enum EffectDirection {
    PLUS,
    MINUS,
}

export enum Class {
    WARRIOR,
    WHITE_MAGE,
    BLACK_MAGE,
    THIEF,
    RANDOM
}

export const ClassLabels = {
    [Class.WARRIOR]: 'Warrior',
    [Class.WHITE_MAGE]: 'White Mage',
    [Class.BLACK_MAGE]: 'Black Mage',
    [Class.THIEF]: 'Thief',
    [Class.RANDOM]: 'Random'
};

export enum Terrain {
    NONE,
    FIRE,
    ICE
}

export enum PlayMode {
    PRACTICE,
    TUTORIAL,
    CASUAL,
    CASUAL_VS_AI,
    CASUAL_VS_FRIEND,
    RANKED,
    RANKED_VS_AI,
    STAKED,
}

export const PlayModeLabels = {
    [PlayMode.PRACTICE]: 'Practice',
    [PlayMode.TUTORIAL]: 'Tutorial',
    [PlayMode.CASUAL]: 'Casual',
    [PlayMode.CASUAL_VS_AI]: 'Casual vs AI',
    [PlayMode.RANKED]: 'Ranked',
    [PlayMode.RANKED_VS_AI]: 'Ranked vs AI',
    [PlayMode.STAKED]: 'Staked',
}

export enum EquipmentSlot {
    WEAPON,
    HELMET,
    ARMOR,
    BELT,
    GLOVES,
    BOOTS,
    LEFT_RING,
    RIGHT_RING,
    NECKLACE
}

export const equipmentSlotLabels = {
    [EquipmentSlot.WEAPON]: 'Weapon',
    [EquipmentSlot.HELMET]: 'Helmet',
    [EquipmentSlot.ARMOR]: 'Armor',
    [EquipmentSlot.BELT]: 'Belt',
    [EquipmentSlot.GLOVES]: 'Gloves',
    [EquipmentSlot.BOOTS]: 'Boots',
    [EquipmentSlot.LEFT_RING]: 'Left Ring',
    [EquipmentSlot.RIGHT_RING]: 'Right Ring',
    [EquipmentSlot.NECKLACE]: 'Necklace'
}

export const equipmentSlotLabelsPlural = {
    [EquipmentSlot.WEAPON]: 'Weapons',
    [EquipmentSlot.HELMET]: 'Helmets',
    [EquipmentSlot.ARMOR]: 'Armors',
    [EquipmentSlot.BELT]: 'Belts',
    [EquipmentSlot.GLOVES]: 'Gloves',
    [EquipmentSlot.BOOTS]: 'Boots',
    [EquipmentSlot.LEFT_RING]: 'Rings',
    [EquipmentSlot.NECKLACE]: 'Necklaces'
}

export const equipmentSlotFields = {
    [EquipmentSlot.WEAPON]: 'weapon',
    [EquipmentSlot.HELMET]: 'helmet',
    [EquipmentSlot.ARMOR]: 'armor',
    [EquipmentSlot.BELT]: 'belt',
    [EquipmentSlot.GLOVES]: 'gloves',
    [EquipmentSlot.BOOTS]: 'boots',
    [EquipmentSlot.LEFT_RING]: 'left_ring',
    [EquipmentSlot.RIGHT_RING]: 'right_ring',
    [EquipmentSlot.NECKLACE]: 'necklace'
}

export enum Rarity {
    COMMON,
    RARE,
    EPIC,
    LEGENDARY
}

export enum ChestColor {
    BRONZE = "bronze",
    SILVER = "silver",
    GOLD = "gold"
}

export enum InventoryType {
    CONSUMABLES = 'consumables',
    EQUIPMENTS = 'equipment',
    SPELLS = 'spells',
    UTILITIES = 'utilities'
}


export enum ItemDialogType {
    CONSUMABLES = 'consumables',
    EQUIPMENTS = 'equipment',
    SPELLS = 'spells',
    UTILITIES = 'utilities',
    SP = 'sp'
}

export enum ShopTab {
    CONSUMABLES,
    EQUIPMENTS,
    SPELLS,
    CHARACTERS
}

export enum InventoryActionType {
    EQUIP,
    UNEQUIP,
    SELL
}

export const RarityColor = [
    '#FFFFFF',
    '#2962A9',
    '#8F2841',
    '#C1770D'
]

export enum StatusEffect {
    FREEZE = "Freeze",
    BURN = "Burn",
    POISON = "Poison",
    SLEEP = "Sleep",
    PARALYZE = "Paralyze",
    MUTE = "Mute",
    HASTE = "Haste",
}

export enum League {
    BRONZE,
    SILVER,
    GOLD,
    ZENITH,
    APEX,
}

export const LeaguesNames = ['Bronze', 'Silver', 'Gold', 'Zenith', 'Apex', 'All Time'];

export enum GameStatus {
    ONGOING,
    COMPLETED,
  }

export enum GEN {
    COMBAT_BEGINS,
    MULTI_KILL,
    MULTI_HIT,
    ONE_SHOT,
    FROZEN,
    BURNING,
    KILL_STREAK,
    TUTORIAL,
}

export enum Token {
    SOL = "SOL",
}

export enum AIAttackMode {
    IDLE,
    ATTACK_ONCE,
    UNLIMITED,
}

export type SPSPendingData = {
    stat: Stat;
    value: number;
}

export enum SpeedClass {
    PASS,
    FAST,
    NORMAL,
    SLOW,
}

export enum TargetHighlight {
    ALLY,
    ENEMY,
    DEAD,
}

export enum LockedFeatures {
    CHARACTER_PURCHASES,
    SPELLS_BATCH_1,
    SPELLS_BATCH_2,
    SPELLS_BATCH_3,
  }
  