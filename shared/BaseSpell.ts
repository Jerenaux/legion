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
    animation: string = '';
    size: number = 0;
    cooldown: number = 0;
    castTime: number = 0;
    shake: boolean = false;
    sfx: string = '';
    score: number= 0;
    yoffset: number = 0;
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
    }
}