import { Target, Terrain, Rarity, Class, SpeedClass, TargetHighlight, LockedFeatures, SpellShopCategory } from "./enums";
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
    radius: number = 0;
    projectile?: string;
    charge?: string;
    speedClass: SpeedClass = SpeedClass.NORMAL;
    sfx: string = '';
    score: number= 0;
    terrain: Terrain = Terrain.NONE;
    rarity: Rarity = Rarity.COMMON;
    price: number = 0;
    minLevel: number = 0;
    classes: Class[] = [];
    status?: StatusEffectData;
    effort: number = 0;
    targetHighlight?: TargetHighlight;
    unlock?: LockedFeatures;
    category?: SpellShopCategory;

    constructor(props: SpellData) {
        Object.assign(this, props);
        this.price = getPrice(props.effort);
        this.rarity = getRarity(props.effort);

        this.cost = 2;
        // this.castTime = 1;
        if (props.target === Target.AOE) {
            this.cost *= Math.round(props.radius * 5);
            // this.castTime *= Math.round(props.radius);
        }
        if (props.terrain === Terrain.FIRE) {
            this.cost = Math.round(this.cost * 1);
            // this.castTime = Math.round(this.castTime * 1.2);
        }
        if (props.terrain === Terrain.ICE) {
            this.cost = Math.round(this.cost * 3);
            // this.castTime = Math.round(this.castTime * 3);
        }

        if (props.status) {
            this.cost = Math.round(this.cost * 2);
            // this.castTime = Math.round(this.castTime * 2);
        }
        // Round cost to a multiple of 5
        this.cost = Math.ceil(this.cost/5)*5;
        // this.castTime = Math.round(this.castTime);

        // Overrides
        if (props.cost) this.cost = props.cost;
    }
}