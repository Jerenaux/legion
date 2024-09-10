import { Target, Rarity, StatusEffect } from "./enums";
import { Effect, ConsumableData } from "./interfaces";
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
    cooldown: number = 0;
    animation: string = '';
    sfx: string = '';
    size?: number = 1;
    price: number = 0;
    rarity: Rarity = Rarity.COMMON;
    effort: number = 0;

    constructor(props: ConsumableData) {
        Object.assign(this, props);
        this.price = getPrice(props.effort);
        this.rarity = getRarity(props.effort);
    }

    getCooldown() {
        return this.cooldown * TIME_COEFFICIENT;
    }
}
