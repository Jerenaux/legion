import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { Stat, Target } from "@legion/shared/enums";
import { BaseItem } from "@legion/shared/BaseItem";

export class Item extends BaseItem {

    getTargets(game: Game, user: ServerPlayer, x: number, y: number): ServerPlayer[] {
        // console.log(`Looking for targets at ${x}, ${y} for spell ${this.name}, target type ${Target[this.target]}`);
        if (this.target === Target.SELF) {
            return [user];
        // } else if (this.target === Target.SINGLE) {
        //     const target = game.getPlayerAt(x, y);
        //     if (target) return [target];
        } else if (this.target === Target.AOE) {
            return game.getPlayersInArea(x, y, this.size);
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
            this.statusRemovals.forEach(status => target.removeStatusEffect(status));
        });
    }

    effectsAreApplicable(target: ServerPlayer) {
        const mainEffectsApplicable = this.effects.every(effect => {
            if (effect.onKO && target.isAlive()) return false;
            switch (effect.stat) {
                case Stat.HP:
                    return target.hp < target.maxHP;
                case Stat.MP:
                    return target.mp < target.maxMP;
            }
        });
        const statusRemovalsApplicable = this.statusRemovals.some(effect => target.hasStatusEffect(effect));
        return mainEffectsApplicable || statusRemovalsApplicable;
    }

    isHealing() {
        return this.effects.some(effect => effect.stat === Stat.HP && effect.value > 0);
    }

    isReviving() {
        return this.effects.some(effect => effect.stat === Stat.HP && effect.onKO);
    }
}