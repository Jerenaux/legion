export enum Stat {
    HP,
    MP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    NONE
}

// TODO: do like ClassLabels below
export const statFields = ["hp", "mp", "atk", "def", "spatk", "spdef"];

export const StatFields = {
    [Stat.HP]: 'hp',
    [Stat.MP]: 'mp',
    [Stat.ATK]: 'atk',
    [Stat.DEF]: 'def',
    [Stat.SPATK]: 'spatk',
    [Stat.SPDEF]: 'spdef'
}

export const StatLabels = {
    [Stat.HP]: 'HP',
    [Stat.MP]: 'MP',
    [Stat.ATK]: 'ATK',
    [Stat.DEF]: 'DEF',
    [Stat.SPATK]: 'SP.ATK',
    [Stat.SPDEF]: 'SP.DEF'
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
    CASUAL,
    CASUAL_VS_AI,
    RANKED
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

export enum ShopTab {
    CONSUMABLES,
    EQUIPMENTS,
    SPELLS,
    CHARACTERS
}

export enum InventoryActionType {
    EQUIP,
    UNEQUIP
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
}