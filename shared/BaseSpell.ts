import { Target, Effect } from "./types";

export class BaseSpell {
    id: number;
    name: string;
    description: string;
    cost: number;
    target: Target;
    effects: Effect[];
    frame: string;
    animation: string;
    size: number;
    cooldown: number;
    castTime: number;
    shake: boolean;
    sfx: string;
    score: number;
    
    constructor(id: number, name: string, description: string, frame: string, sfx: string, animation: string,
        cooldown: number, castTime: number, cost: number, target: Target, size: number, effects: Effect[],
        shake: boolean = false, score: number = 0) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.frame = frame;
        this.animation = animation;
        this.cost = cost;
        this.castTime = castTime;
        this.target = target;
        this.effects = effects;
        this.size = size;
        this.cooldown = cooldown;
        this.shake = shake;
        this.sfx = sfx;
        this.score = score;
    }
}