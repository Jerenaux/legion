export enum Stat {
    HP,
    MP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    NONE
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

export enum Terrain {
    NONE,
    FIRE
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

export enum InventoryType {
    SKILLS = 'spells',
    EQUIPMENTS = 'equipment',
    CONSUMABLES = 'consumables',
    UTILITIES = 'utilities'
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