import {effectAmount} from '@legion/shared/combatBalance';
import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { Stat, Target, Terrain } from "@legion/shared/enums";
import { Effect } from "@legion/shared/interfaces";

import { BaseSpell } from "@legion/shared/BaseSpell";

export function convertBaseToSpell(base: BaseSpell): Spell {
    return new Spell(base);
}

export class Spell extends BaseSpell {

    getTargets(game: Game, x: number, y: number): ServerPlayer[] {
        // console.log(`Looking for targets at ${x}, ${y} for spell ${this.name}, target type ${Target[this.target]}`);
        if (this.target === Target.SINGLE) {
            const target = game.getPlayerAt(x, y);
            if (target) return [target];
        } else if (this.target === Target.AOE) {
            return game.getPlayersInArea(x, y, this.radius - 1);
        }
        return [];
    }

    applyEffect(caster: ServerPlayer, targets: ServerPlayer[]) {
        targets.forEach(target => {target.resetPreviousHP();});
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
            if (target.isFrozen()) {
                target.showDamageImmunity();
                return;
            }
            const damage = effectAmount(effect, caster, target);
            target.takeDamage(this.terrain === Terrain.FIRE ? target.fireDamage(damage) : damage);
        });
    }

    heal(caster: ServerPlayer, targets: ServerPlayer[], effect: Effect) {
        targets.forEach(target => {
            if (!target.isAlive() && !effect.onKO) return;
            if (effect.onKO && target.isAlive()) return;
            const heal = effectAmount(effect, caster, target);
            target.heal(heal);
        });
    }

    isHealingSpell() {
        return this.effects.some(effect => effect.stat === Stat.HP && effect.value > 0);
    }

    isStatusEffectSpell() {
        return this.status?.effect !== undefined;
    }

    getHealAmount() {
        return this.effects.find(effect => effect.stat === Stat.HP && effect.value > 0)?.value ?? 0;
    }

    isApplicable(target: ServerPlayer) {
        if (this.effects.some(effect => effect.onKO) && !target.isAlive()) return true;
        if (this.effects.every(effect => !effect.onKO) && target.isAlive()) return true;
        return false;
    }
}
