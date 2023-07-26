import { ServerPlayer } from './ServerPlayer';

type Comparator<T> = (a: T, b: T) => number;

const highestHpComparator: Comparator<ServerPlayer> = (a, b) => a.hp - b.hp;
const lowestHpComparator: Comparator<ServerPlayer> = (a, b) => b.hp - a.hp;

enum AIType {
    Opportunist,
    Hunter,
    Equalizer,
    Defender
}

export class AIServerPlayer extends ServerPlayer {
    AItype: AIType;

    constructor(frame: string, x: number, y: number) {
        super(frame, x, y);

        // Pick a random number between 1 and 3
        const random = Math.floor(Math.random() * 3) + 1;
        switch (random) {
            case 1:
                this.AItype = AIType.Opportunist;
                break;
            case 2:
                this.AItype = AIType.Hunter;
                break;
            case 3:
                this.AItype = AIType.Equalizer;
                break;
            default:
                this.AItype = AIType.Opportunist;
                break;
        }

        // TODO: add factor determining how often the AI re-evaluates its taget
    }

    takeAction() {
        if (!this.canAct) return;

        // Opportunist: attacks if adjacent, otherwise moves towards closest enemy
        // Hunter: targets the enemy with the lowest HP
        // Equalizer: targets the enemy with the highest HP
        // Defender: targets enemy closest to lowest HP ally

        // TODO: separate step to determine target

        switch (this.AItype) {
            case AIType.Opportunist:
                this.opportunist();
                break;
            // case AIType.Hunter:
            //     this.hunter();
            //     break;
            // case AIType.Equalizer:
            //     this.equalizer();
            //     break;
            // case AIType.Defender:
            //     this.defender();
            //     break;
            default:
                this.opportunist();
                break;
        }
    }

    getOptimalTarget(targets: ServerPlayer[], comparator: Comparator<ServerPlayer>) {
        let optimalTarget: ServerPlayer | null = null;
        targets.forEach(target => {
            if (!optimalTarget || comparator(target, optimalTarget) > 0) {
                optimalTarget = target;
            }
        });
        return optimalTarget;
    }

    opportunist() {
        const targets = this.team?.game.listAdjacentEnemies(this);
        const target = this.getOptimalTarget(targets!, lowestHpComparator);
        if (target) {
            this.attack(target);
        } else {
            this.moveTowardsClosestEnemy();
        }
    }

    // hunter() {
    //     const targets = this.team?.game.listAllEnemies(this);
    //     const target = this.getOptimalTarget(targets!, lowestHpComparator);
    //     if (target) {
    //         this.attack(target);
    //     }
    // }

    // equalizer() {
    //     const targets = this.team?.game.listAllEnemies(this);
    //     const target = this.getOptimalTarget(targets!, highestHpComparator);
    //     if (target) {
    //         this.attack(target);
    //     }
    // }

    // defender() {
    //     const target = this.getClosestEnemyToLowestHPAlly();
    //     if (target) {
    //         this.attack(target);
    //     }
    // }
}