import { Target, Terrain, Rarity, Class } from "./enums";
import { Effect, SpellData, StatusEffectData } from "./interfaces";
import { getPrice, getRarity } from "./economy";

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

        this.cost = 3;
        this.cooldown = 2;
        this.castTime = 1;
        if (props.target == Target.AOE) {
            this.cost *= props.size * 3;
            this.cooldown *= props.size;
            this.castTime *= props.size;
        }
        if (props.terrain != Terrain.NONE) {
            this.cost = Math.round(this.cost * 1.5);
            this.cooldown = Math.round(this.cooldown * 1.1);
            this.castTime = Math.round(this.castTime * 1.2);
        }
    
        if (props.status) {
            this.cost = Math.round(this.cost * 1.5);
            this.cooldown = Math.round(this.cooldown * 1.1);
            this.castTime = Math.round(this.castTime * 1.2);
        }
        // Round cost to a multiple of 5
        this.cost = Math.ceil(this.cost/5)*5;
        this.cooldown = Math.round(this.cooldown);
        this.castTime = Math.round(this.castTime);
    }
}