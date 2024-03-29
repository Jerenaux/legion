import { EQUIPMENT_TYPE } from "../itemDialog/ItemDialogType";

export const EQUIPITEMS_DEFAULT = [
    {
        name: 'WEAPON',
        url: './inventory/weapon_icon.png'
    },
    {
        name: 'HELM',
        url: './inventory/helm_icon.png'
    },
    {
        name: 'ARMOR',
        url: './inventory/armor_icon.png'
    },
    {
        name: 'BELT',
        url: './inventory/belt_icon.png'
    },
    {
        name: 'GLOVES',
        url: './inventory/gloves_icon.png'
    },
    {
        name: 'BOOTS',
        url: './inventory/boots_icon.png'
    }
];

export const EQUIPITEMS = [
    {
        type: EQUIPMENT_TYPE.WEAPON,
        name: 'sword_001',
        url: './equipments/sword_001.png'
    },
    {
        type: EQUIPMENT_TYPE.HELM,
        name: '',
        url: ''
    },
    {
        type: EQUIPMENT_TYPE.ARMOR,
        name: '',
        url: ''
    },
    {
        type: EQUIPMENT_TYPE.BELT,
        name: '',
        url: ''
    },
    {
        type: EQUIPMENT_TYPE.GLOVES,
        name: '',
        url: ''
    },
    {
        type: EQUIPMENT_TYPE.BOOTS,
        name: '',
        url: ''
    }
];

export const CHARACTERINFO = [
    {
        name: 'HP',
        currVal: 100,
        additionVal: '+2'
    },
    {
        name: 'MP',
        currVal: 20,
        additionVal: '-3'
    },
    {
        name: 'ATK',
        currVal: 11,
        additionVal: '+5'
    },
    {
        name: 'DEF',
        currVal: 10,
        additionVal: ''
    },
    {
        name: 'SP.ATK',
        currVal: 11,
        additionVal: ''
    },
    {
        name: 'SP.DEF',
        currVal: 10,
        additionVal: ''
    },
];

export const SPELLITEMS = [
    {
        name: 'fireball',
        url: './spells/fireball.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            mp: 30,
            cd: 10
        }
    },
    {
        name: 'iceball',
        url: './spells/iceball.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            mp: 10,
            cd: 3
        }
    },
    {
        name: 'thunder',
        url: './spells/thunder.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            mp: 25,
            cd: 8
        }
    },
    {
        name: '',
        url: '',
        desc: '',
        info: {
            mp: 0,
            cd: 0
        }
    },
    {
        name: '',
        url: '',
        desc: '',
        info: {
            mp: 0,
            cd: 0
        }
    },
    {
        name: '',
        url: '',
        desc: '',
        info: {
            mp: 0,
            cd: 0
        }
    }
];

export const CONSUMABLEITEMS = [
    {
        name: 'potion',
        url: './consumables/potion.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            hp: 10,
            mp: 10,
        }
    },
    {
        name: 'potion',
        url: './consumables/potion.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            hp: 10,
            mp: 10,
        }
    },
    {
        name: 'hi-potion',
        url: './consumables/hi-potion.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            hp: 30,
            mp: 20,
        }
    },
    {
        name: 'ether',
        url: './consumables/ether.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            def: 10,
            sp_atk: 20,
        }
    },
    {
        name: 'hi-ether',
        url: './consumables/hi-ether.png',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            mp: -3,
            def: 30,
            sp_atk: 25,
        }
    },
    {
        name: '',
        url: '',
        desc: 'Lorem Ipsum has been the industrys standard dummy text ever since the 1500s',
        info: {
            def: 30,
            sp_atk: 25,
        }
    }
];