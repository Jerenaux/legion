import { Effect, EquipmentData } from "./interfaces";
import { EquipmentSlot, Rarity, Class } from "./enums";
import { getPrice, getRarity } from "./economy";


export class BaseEquipment {
    id: number = -1;
    name: string = '';
    description: string = '';
    frame: number = 0;
    slot: EquipmentSlot = EquipmentSlot.WEAPON;
    effects: Effect[] = [];
    price: number = 0; 
    effort: number = 0;
    rarity: Rarity = Rarity.COMMON;
    minLevel: number = 0;
    classes: Class[] = [];
    beltSize?: number;

    constructor(props: EquipmentData) {
        Object.assign(this, props);
        this.price = getPrice(props.effort);
        this.rarity = getRarity(props.effort);
    }
}
