import { Effect, EquipmentData } from "./interfaces";
import { EquipmentSlot, Rarity } from "./enums";


export class BaseEquipment {
    id: number = -1;
    name: string = '';
    description: string = '';
    frame: string = '';
    slot: EquipmentSlot = EquipmentSlot.WEAPON;
    effects: Effect[] = [];
    price: number = 0;
    rarity: Rarity = Rarity.COMMON;

    constructor(props: EquipmentData) {
        Object.assign(this, props);
    }
}
