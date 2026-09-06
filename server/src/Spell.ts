import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { Stat, Target, EffectDirection, } from "@legion/shared/enums";
import { EffectModifiers, EffectModifier, Effect } from "@legion/shared/interfaces";

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

    modulateEffectAll(modifiers: EffectModifiers, caster: ServerPlayer, target: ServerPlayer, value: number) {
        return this.modulateEffect(
            modifiers.casterModifier,
            caster,
           this.modulateEffect(modifiers.targetModifier, target, value)
        );
    }

    modulateEffect(modifier: EffectModifier, player: ServerPlayer, value: number) {
        if (modifier.stat === Stat.NONE) return value;
        const statValue = player.getStat(modifier.stat);
        const sign = modifier.direction === EffectDirection.PLUS ? 1 : -1;
        const random = (Math.random() - 0.5)/10;

        // Store the original sign of the value
        const originalSign = Math.sign(value);

        // Calculate the modified value
        let modifiedValue = value * (1 + (statValue * modifier.value * sign)) * (1 + random);

        // Ensure the sign of the value doesn't change (damage stays damage, healing stays healing)
        // If sign flipped, set to a minimum effect value (e.g., 1)
        if (Math.sign(modifiedValue) !== originalSign) {
            modifiedValue = originalSign * 1; // Minimum effect of 1 in the original direction
        }

        return modifiedValue;
    }

    dealDamage(caster: ServerPlayer, targets: ServerPlayer[], effect: Effect) {
        targets.forEach(target => {
            if (!target.isAlive()) return;
            let damage = effect.value * -1;
            // console.log(`Dealing ${damage} damage`);
            if (effect.modifiers) damage = this.modulateEffectAll(effect.modifiers, caster, target, damage);
            target.takeDamage(damage);
        });
    }

    heal(caster: ServerPlayer, targets: ServerPlayer[], effect: Effect) {
        targets.forEach(target => {
            if (!target.isAlive() && !effect.onKO) return;
            let heal = effect.value;
            // console.log(`Healing ${heal} damage`);
            if (effect.modifiers) heal = this.modulateEffectAll(effect.modifiers, caster, target, heal);
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
