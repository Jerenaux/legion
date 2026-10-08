import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { Stat, Target } from "@legion/shared/enums";
import { BaseItem } from "@legion/shared/BaseItem";
import { itemNoEffectReason, ItemNoEffectReason } from "@legion/shared/itemUse";

export class Item extends BaseItem {

    getTargets(game: Game, user: ServerPlayer, x: number, y: number): ServerPlayer[] {
        // console.log(`Looking for targets at ${x}, ${y} for spell ${this.name}, target type ${Target[this.target]}`);
        if (this.target === Target.SELF) {
            return [user];
        } else if (this.target === Target.AOE) {
            return game.getPlayersInArea(x, y, this.radius);
        }
        return [];
    }

    applyEffect(targets: ServerPlayer[]) {
        targets.forEach(target => {
            target.resetPreviousHP();
            this.effects.forEach(effect => {
                if (effect.onKO && target.isAlive()) return;
                if (!effect.onKO && !target.isAlive()) return;
                let value: number;
                switch (effect.stat) {
                    case Stat.HP:
                        value = effect.value === -1 ? target.getMaxHP() : effect.value;
                        target.heal(value);
                        break;
                    case Stat.MP:
                        value = effect.value === -1 ? target.getMaxMP() : effect.value;
                        target.restoreMP(value);
                        break;
                }
            });
            this.statusRemovals.forEach(status => {
                target.removeStatusEffect(status);
            });
            if (this.status) {
                target.addStatusEffect(this.status.effect, this.status.duration, this.status.chance)
            }
        });
    }

    noEffectReason(target: ServerPlayer): ItemNoEffectReason | null {
        return itemNoEffectReason(this, {
            alive: target.isAlive(), hp: target.hp, maxHP: target.getMaxHP(), mp: target.mp, maxMP: target.getMaxMP(),
            hasStatus: status => target.hasStatusEffect(status),
        });
    }

    effectsAreApplicable(target: ServerPlayer) {
        return this.noEffectReason(target) === null;
    }

    isHealing() {
        return this.effects.some(effect => effect.stat === Stat.HP && effect.value > 0);
    }

    isReviving() {
        return this.effects.some(effect => effect.stat === Stat.HP && effect.onKO);
    }
}
