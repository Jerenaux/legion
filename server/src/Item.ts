import { ServerPlayer } from "./ServerPlayer";
import { EffectModifiers } from "./Spell";

export enum Stat {
    HP,
    MP,
    ATK,
    DEF,
    SPATK,
    SPDEF,
    NONE
}

export interface Effect {
    stat: Stat;
    value: number;
    modifiers?: EffectModifiers;
}

export enum Target {
    SELF,
    AOE,
    SINGLE
}

export interface NetworkItem {
    id: number;
    name: string;
    description: string;
    frame: string;
    effects: NetworkItemEffect[];
    target: string;
    cooldown: number;
    // animation: string;
}

interface NetworkItemEffect {
    stat: string;
    value: number;
}

export class Item {
    id: number;
    name: string;
    description: string;
    frame: string;
    effects: Effect[];
    target: Target;
    cooldown: number;
    animation: string;
    sfx: string;

    constructor(
        id: number, name: string, description: string, frame: string, sfx: string, animation: string,
        cooldown: number, target: Target, effects: Effect[]
    ) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.frame = frame;
        this.target = target;
        this.effects = effects;
        this.cooldown = cooldown;
        this.animation = animation;
        this.sfx = sfx;
    }

    getNetworkData(): NetworkItem {
        const effects = this.effects.map(effect => {
            return {
                'stat': Stat[effect.stat],
                'value': effect.value
            }
        });
        return {
            'id': this.id,
            'name': this.name,
            'frame': this.frame,
            'description': this.description,
            'effects': effects,
            'target': Target[this.target],
            'cooldown': this.cooldown,
            // 'animation': this.animation
        }
    }

    applyEffect(target: ServerPlayer) {
        this.effects.forEach(effect => {
            switch (effect.stat) {
                case Stat.HP:
                    target.heal(effect.value);
                    break;
                case Stat.MP:
                    target.restoreMP(effect.value);
                    break;
            }
        });
    }

    effectsAreApplicable(target: ServerPlayer) {
        return this.effects.every(effect => {
            switch (effect.stat) {
                case Stat.HP:
                    return target.hp + effect.value <= target.maxHP;
                case Stat.MP:
                    return target.mp + effect.value <= target.maxMP;
            }
        });
    }
}