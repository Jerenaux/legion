export enum Stat {
    HP,
    MP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    NONE
}

export const statFields = ["hp", "mp", "atk", "def", "spatk", "spdef"];

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

export enum Terrain {
    NONE,
    FIRE,
    ICE
}

export enum PlayMode {
    PRACTICE,
    CASUAL,
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
    SKILLS = 'spells',
    UTILITIES = 'utilities'
}

export enum ShopTabs {
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
    FREEZE,
    BURN,
    POISON,
    SLEEP,
    PARALYZE
}

export const equipmentFields = ["weapon", "helmet", "armor", "belt", "gloves",
  "boots", "left_ring", "right_ring", "necklace"];


export enum rankNoImage {
    'gold_rankno',
    'silver_rankno',
    'bronze_rankno'
}