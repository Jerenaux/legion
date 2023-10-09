import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { Stat, Target, Effect, EffectModifiers, EffectModifier, EffectDirection } from "@legion/shared";
import { BaseSpell } from "@legion/shared/BaseSpell";

export function convertBaseToSpell(base: BaseSpell): Spell {
    return new Spell(
        base.id,
        base.name,
        base.description,
        base.frame,
        base.sfx,
        base.animation,
        base.cooldown,
        base.castTime,
        base.cost,
        base.target,
        base.size,
        base.effects,
        base.shake,
        base.score,
    );
}

export class Spell extends BaseSpell {
    
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
        return value * (1 + (statValue * modifier.value * sign)) * (1 + random);
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
            if (!target.isAlive()) return;
            let heal = effect.value;
            // console.log(`Healing ${heal} damage`);
            if (effect.modifiers) heal = this.modulateEffectAll(effect.modifiers, caster, target, heal);
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