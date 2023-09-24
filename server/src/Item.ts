import { ServerPlayer } from "./ServerPlayer";
import { EffectModifiers } from "./Spell";
import { Game } from "./Game";

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
    onKO?: boolean;
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
    size: number = 1;

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

    getTargets(game: Game, user: ServerPlayer, x: number, y: number): ServerPlayer[] {
        // console.log(`Looking for targets at ${x}, ${y} for spell ${this.name}, target type ${Target[this.target]}`);
        if (this.target === Target.SELF) {
            return [user];
        } else if (this.target === Target.SINGLE) {
            const target = game.getPlayerAt(x, y);
            if (target) return [target];
        } else if (this.target === Target.AOE) {
            return game.getPlayersInArea(x, y, Math.floor(this.size/2));
        }
        return [];
    }

    applyEffect(targets: ServerPlayer[]) {
        targets.forEach(target => {
            target.resetPreviousHP();
            this.effects.forEach(effect => {
                if (effect.onKO && target.isAlive()) return;
                if (!effect.onKO && !target.isAlive()) return;
                let value;
                switch (effect.stat) {
                    case Stat.HP:
                        value = effect.value == -1 ? target.maxHP : effect.value;
                        target.heal(value);
                        break;
                    case Stat.MP:
                        value = effect.value == -1 ? target.maxMP : effect.value;
                        target.restoreMP(value);
                        break;
                }
            });
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