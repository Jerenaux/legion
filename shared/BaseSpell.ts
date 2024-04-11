import { Target, Terrain, Rarity } from "./enums";
import { Effect, SpellData, StatusEffectData } from "./interfaces";

export class BaseSpell {
    id: number = -1;
    name: string = '';
    description: string = '';
    cost: number = 0;
    target: Target = Target.SINGLE;
    effects: Effect[] = [];
    frame: string = '';
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
    status?: StatusEffectData;
    
    constructor(props: SpellData) {
        Object.assign(this, props);
    }
}