import { ServerPlayer } from "./ServerPlayer";
import { Stat, Effect, Target } from "./Item";
import { Game } from "./Game";

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
        if (this.stat === Stat.NONE) return value;
        const statValue = player.getStat(this.stat);
        const sign = this.direction === EffectDirection.PLUS ? 1 : -1;
        const random = (Math.random() - 0.5)/10;
        return value * (1 + (statValue * this.value * sign)) * (1 + random);
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
    shake;
    sfx;
    score;
    
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

    getTargets(game: Game, x: number, y: number): ServerPlayer[] {
        // console.log(`Looking for targets at ${x}, ${y} for spell ${this.name}, target type ${Target[this.target]}`);
        if (this.target === Target.SINGLE) {
            const target = game.getPlayerAt(x, y);
            if (target) return [target];
        } else if (this.target === Target.AOE) {
            return game.getPlayersInArea(x, y, Math.floor(this.size/2));
        }
        return [];
    }

    applyEffect(caster: ServerPlayer, targets: ServerPlayer[]) {
        this.effects.forEach(effect => {
            switch (effect.stat) {
                case Stat.HP:
                    if (effect.value < 0) this.dealDamage(caster, targets, effect);
                    if (effect.value > 0) this.heal(caster, targets, effect);
                    break;
            }
        });
    }

    dealDamage(caster: ServerPlayer, targets: ServerPlayer[], effect: Effect) {
        targets.forEach(target => {
            if (!target.isAlive()) return;
            let damage = effect.value * -1;
            // console.log(`Dealing ${damage} damage`);
            if (effect.modifiers) damage = effect.modifiers.modulateEffect(caster, target, damage);
            target.takeDamage(damage);
        });
    }

    heal(caster: ServerPlayer, targets: ServerPlayer[], effect: Effect) {
        targets.forEach(target => {
            if (!target.isAlive()) return;
            let heal = effect.value;
            // console.log(`Healing ${heal} damage`);
            if (effect.modifiers) heal = effect.modifiers.modulateEffect(caster, target, heal);
            target.heal(heal);
        });
    }

    isHealingSpell() {
        return this.effects.some(effect => effect.stat === Stat.HP && effect.value > 0);
    }

    getHealAmount() {
        return this.effects.find(effect => effect.stat === Stat.HP && effect.value > 0)?.value ?? 0;
    }
}