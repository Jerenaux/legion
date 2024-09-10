import { Target, Terrain, Rarity, Class } from "./enums";
import { Effect, SpellData, StatusEffectData } from "./interfaces";
import { getPrice, getRarity } from "./economy";
import { TIME_COEFFICIENT } from "@legion/shared/config";
export class BaseSpell {
    id: number = -1;
    name: string = '';
    description: string = '';
    cost: number = 0;
    target: Target = Target.SINGLE;
    effects: Effect[] = [];
    frame: number = 0;
    vfx: string = '';
    size: number = 0;
    cooldown: number = 0;
    castTime: number = 0;
    shake: boolean = false;
    sfx: string = '';
    score: number= 0;
    yoffset: number = 0;
    scale: number = 1;
    terrain: Terrain = Terrain.NONE;
    rarity: Rarity = Rarity.COMMON;
    price: number = 0;
    minLevel: number = 0;
    classes: Class[] = [];
    status?: StatusEffectData;
    effort: number = 0;
    
    constructor(props: SpellData) {
        Object.assign(this, props);
        this.price = getPrice(props.effort);
        this.rarity = getRarity(props.effort);

        this.cost = 2;
        this.cooldown = 3;
        this.castTime = 1;
        if (props.target == Target.AOE) {
            this.cost *= Math.round(props.size * 5);
            this.cooldown *= Math.round(props.size);
            this.castTime *= Math.round(props.size);
        }
        if (props.terrain == Terrain.FIRE) {
            this.cost = Math.round(this.cost * 1);
            this.cooldown = Math.round(this.cooldown * 1.2);
            this.castTime = Math.round(this.castTime * 1.2);
        }
        if (props.terrain == Terrain.ICE) {
            this.cost = Math.round(this.cost * 3);
            this.cooldown = Math.round(this.cooldown * 3);
            this.castTime = Math.round(this.castTime * 3);
        }
    
        if (props.status) {
            this.cost = Math.round(this.cost * 2);
            this.cooldown = Math.round(this.cooldown * 2);
            this.castTime = Math.round(this.castTime * 2);
        }
        // Round cost to a multiple of 5
        this.cost = Math.ceil(this.cost/5)*5;
        this.cooldown = Math.round(this.cooldown);
        this.castTime = Math.round(this.castTime);

        // Overrides
        if (props.cost) this.cost = props.cost;
    }

    getCooldown() {
        return this.cooldown * TIME_COEFFICIENT;
    }
}