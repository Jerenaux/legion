import { Target, Rarity, StatusEffect, SpeedClass } from "./enums";
import { Effect, ConsumableData, StatusEffectData } from "./interfaces";
import { getPrice, getRarity } from "./economy";
import { TIME_COEFFICIENT } from "@legion/shared/config";

export class BaseItem {
    id: number = -1;
    name: string = '';
    description: string = '';
    frame: number = 0;
    effects: Effect[] = [];
    statusRemovals: StatusEffect[] = [];
    target: Target = Target.SINGLE;
    animation: string = '';
    sfx: string = '';
    speedClass: SpeedClass = SpeedClass.NORMAL;
    size?: number = 1;
    price: number = 0;
    rarity: Rarity = Rarity.COMMON;
    effort: number = 0;
    status?: StatusEffectData;

    constructor(props: ConsumableData) {
        Object.assign(this, props);
        this.price = getPrice(props.effort);
        this.rarity = getRarity(props.effort);
    }
}
