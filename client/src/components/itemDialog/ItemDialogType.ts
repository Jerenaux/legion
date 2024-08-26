import {Stat} from '@legion/shared/enums';

export enum ItemDialogType {
    SKILLS = 'spells',
    EQUIPMENTS = 'equipment',
    CONSUMABLES = 'consumables',
    UTILITIES = 'utilities',
    SP = 'sp'
}

export enum  EQUIPMENT_TYPE {
    WEAPON = 'WEAPON',
    HELM = 'HELM',
    ARMOR = 'ARMOR',
    BELT = 'BELT',
    GLOVES = 'GLOVES',
    BOOTS = 'BOOTS',
}

export enum STATS_NAMES {
    hp = 'HP',
    mp = 'MP',
    atk = 'ATK',
    def = 'DEF',
    spatk = 'SP.ATK',
    spdef = 'SP.DEF',
}

export enum STATS_BG_COLOR {
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

export type SPSPendingData = {
    stat: Stat;
    value: number;
}