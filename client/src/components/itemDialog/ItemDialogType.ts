export enum ItemDialogType {
    SKILLS = 'spells',
    EQUIPMENTS = 'equipment',
    CONSUMABLES = 'consumables',
    UTILITIES = 'utilities',
    CHARACTER_INFO = 'character_info'
}

export enum  EQUIPMENT_TYPE {
    WEAPON = 'WEAPON',
    HELM = 'HELM',
    ARMOR = 'ARMOR',
    BELT = 'BELT',
    GLOVES = 'GLOVES',
    BOOTS = 'BOOTS',
}

export enum INFO_TYPE {
    hp = 'HP',
    mp = 'MP',
    atk = 'ATK',
    def = 'DEF',
    spatk = 'SP.ATK',
    spdef = 'SP.DEF',
}

export enum INFO_BG_COLOR {
    HP = '#628c27',
    MP = '#1f659a',
    ATK = '#9a1f3c',
    DEF = '#cc872d',
    'SP.ATK' = '#26846b',
    'SP.DEF' = '#703fba',
    'SPATK' = '#26846b',
    'SPDEF' = '#703fba',
}

export type DETAIL_INFO = {
    hp?: number;
    mp?: number;
    atk?: number;
    def?: number;
    sp_atk?: number;
    sp_def?: number;
}

export type EQUIPMENT = {
    type: EQUIPMENT_TYPE;
    name: string;
    url: string;
}

export type CONSUMABLE = {
    name: string;
    url: string;
    desc: string;
    info: DETAIL_INFO;
}

export type CHARACTER_INFO = {
    key: string;
    value: number;
    effect?: string;
}

export type SPELL = {
    name: string;
    url: string;
    desc: string;
    info: {
        mp: number;
        cd: number;
    }
}