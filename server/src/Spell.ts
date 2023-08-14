import { ServerPlayer } from "./ServerPlayer";
import { Stat, Effect, Target } from "./Item";
export class EffectModifier {
    stat;
    value;
    direction;

    constructor(stat: Stat, value: number, direction: EffectDirection) {
        this.stat = stat;
        this.value = value;
        this.direction = direction;
    }

    modulateEffect(player: ServerPlayer, value: number) {
        const statValue = player.getStat(this.stat);
        const sign = this.direction === EffectDirection.PLUS ? 1 : -1;
        return value * (1 + (statValue * this.value * sign));
    }
}

export class EffectModifiers {
    casterModifier;
    targetModifier;

    constructor(casterModifier: EffectModifier, targetModifier: EffectModifier) {
        this.casterModifier = casterModifier;
        this.targetModifier = targetModifier;
    }

    modulateEffect(caster: ServerPlayer, target: ServerPlayer, value: number) {
        return this.casterModifier.modulateEffect(
                caster,
                this.targetModifier.modulateEffect(target, value)
            );
    }
}

export enum EffectDirection {
    PLUS,
    MINUS
}

export interface NetworkSpell {
    id: number;
    name: string;
    description: string;
    frame: string;
    cost: number;
    target: string;
    size: number;
    cooldown: number;
    effects: NetworkSpellEffect[];
}

export interface NetworkSpellEffect {
    stat: string;
    value: number;
    modifiers: NetworkEffectModifiers | null;
}

export interface NetworkEffectModifiers {
    casterModifier: NetworkEffectModifier;
    targetModifier: NetworkEffectModifier;
}

export interface NetworkEffectModifier {
    stat: string;
    value: number;
    direction: string;
}

export class Spell {
    id;
    name;
    description;
    cost;
    target;
    effects;
    frame;
    animation;
    size;
    cooldown;
    castTime;

    constructor(id: number, name: string, description: string, frame: string, animation: string,
        cooldown: number, castTime: number, cost: number, target: Target, size: number, effects: Effect[]) {
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
    }

    getNetworkData(): NetworkSpell {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            frame: this.frame,
            cost: this.cost,
            target: Target[this.target],
            size: this.size,
            cooldown: this.cooldown,
            effects: this.effects.map(effect => {
                return {
                    stat: Stat[effect.stat],
                    value: effect.value,
                    modifiers: effect.modifiers ? {
                        casterModifier: {
                            stat: Stat[effect.modifiers.casterModifier.stat],
                            value: effect.modifiers.casterModifier.value,
                            direction: EffectDirection[effect.modifiers.casterModifier.direction]
                        },
                        targetModifier: {
                            stat: Stat[effect.modifiers.targetModifier.stat],
                            value: effect.modifiers.targetModifier.value,
                            direction: EffectDirection[effect.modifiers.targetModifier.direction]
                        }
                    } : null
                }
            })
        }
    }

    applyEffect(caster: ServerPlayer, targets: ServerPlayer[]) {
        this.effects.forEach(effect => {
            switch (effect.stat) {
                case Stat.HP:
                    if (effect.value < 0) this.dealDamage(caster, targets, effect);
                    break;
            }
        });
    }

    dealDamage(caster: ServerPlayer, targets: ServerPlayer[], effect: Effect) {
        targets.forEach(target => {
            let damage = effect.value * -1;
            if (effect.modifiers) damage = effect.modifiers.modulateEffect(caster, target, damage);
            target.takeDamage(damage);
        });
    }
}