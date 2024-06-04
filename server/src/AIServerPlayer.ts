import { ServerPlayer, ActionType } from './ServerPlayer';
import { Target } from "@legion/shared/enums";

type Comparator<T> = (a: T, b: T) => number;

const highestHpComparator: Comparator<ServerPlayer> = (a, b) => a.hp - b.hp;
const lowestHpComparator: Comparator<ServerPlayer> = (a, b) => b.hp - a.hp;
const highestDamageComparator: Comparator<ServerPlayer> = (a, b) => a.damageDealt - b.damageDealt;

enum AIType {
    Opportunist,
    Hunter,
    Equalizer,
    Defender,
    Hero
}

export class AIServerPlayer extends ServerPlayer {
    AItype: AIType = AIType.Opportunist;
    target: ServerPlayer | null = null;
    retargetRate: number = 0;
    retargetCount: number = 0;

    constructor(num: number, name: string, frame: string, x: number, y: number) {
        super(num, name, frame, x, y);

        this.setArchetype();

        // Assign a random value between 1 and 10 to retargetCount
        this.retargetRate = Math.floor(Math.random() * 10) + 1;
        this.retargetCount = this.retargetRate;

        const cooldown = this.getCooldown('move') + this.entranceTime * 1000;
        this.setCooldown(cooldown, false);
    }

    setArchetype() {
        // Opportunist: attacks if adjacent, otherwise moves towards closest enemy
        // Hunter: targets the enemy with the lowest HP
        // Equalizer: targets the enemy with the highest HP
        // Defender: targets enemy closest to lowest HP ally
        // Hero: targets biggest damage dealer

        const random = Math.floor(Math.random() * 4) + 1;
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
            case 4:
                this.AItype = AIType.Defender;
                break;
            case 5:
                this.AItype = AIType.Hero;
                break;
            default:
                this.AItype = AIType.Opportunist;
                break;
        }
    }

    getCooldown(action: ActionType) {
        // Return a random number between 1 and 1.3 times the cooldown
        return Math.floor(this.cooldowns[action] * (1 + Math.random() * 0.3));
    }

    takeAction(): number {
        if (!this.canAct()) return 0;
        let delay = 0;

        if (this.checkForItemUse()) return 0;
        
        delay = this.checkForHealUse();
        if (delay > -1)
            return delay;

        delay = this.checkForAoE();
        if (delay > -1)
            return delay;

        if (!this.target || !this.target.isAlive()) this.determineTarget();
        if(!this.target) {
            // console.log(`AI ${this.num} has no target! ${this.target}`);    
            return;
        }

        if (this.isNextTo(this.target!.x, this.target!.y)) {
            this.attack(this.target!);
        } else {
            this.moveTowards(this.target!.x, this.target!.y);
        }

        this.retargetCount--;
        if (this.retargetCount <= 0) {
            this.target = null;
            this.retargetCount = this.retargetRate;
        }

        return 0;
    }

    checkForItemUse() {
        // Iterate over the 5 item slots
        for (let i = 0; i < 5; i++) {
            const item = this.getItemAtIndex(i);
            if (!item) continue;
            if (item.effectsAreApplicable(this)) {
                const data = {
                    num: this.num,
                    x: this.x,
                    y: this.y,
                    index: i,
                    targetTeam: null,
                    target: null,
                };
                this.team?.game.processUseItem(data, this.team);
                return true;
            }
        }
        return false;
    }

    checkForHealUse(): number {
        for (let i = 0; i < this.spells.length; i++) {
            const spell = this.spells[i];
            if (spell.cost > this.mp) continue;
            if (spell.target != Target.SINGLE) continue;
            if (!spell.isHealingSpell()) continue;

            const allies = this.team?.game.listAllAllies(this);
            if (!allies || allies.length === 0) return -1;
            const ally = this.getOptimalTarget(allies!, lowestHpComparator);
            if (!ally) return -1;

            const healAmount = spell.getHealAmount();
            if (ally.hp <= (ally.maxHP - healAmount)) {
                const data = {
                    num: this.num,
                    x: ally.x,
                    y: ally.y,
                    index: i,
                    targetTeam: ally.team.id,
                    target: ally.num,
                };
                this.team?.game.processMagic(data, this.team);
                return spell.castTime * 1000;
            }
        }
        return -1;
    }

    checkForAoE(): number {
        // Return if random number below 0.5
        if (Math.random() < 0.6) return -1;
        for (let i = 0; i < this.spells.length; i++) {
            const spell = this.spells[i];
            // console.log(`AI ${this.num} checking spell ${spell.name}, cost = ${spell.cost}, mp = ${this.mp}`);
            if (spell.cost > this.mp) {
                // console.log(`AI ${this.num} spell ${spell.name} cost ${spell.cost} is too high`);
                continue;
            }
            if (spell.target != Target.AOE) continue;
            const tile = this.team?.game.scanGridForAoE(this, spell.size, spell.size - 1);
            if (tile) {
                const data = {
                    num: this.num,
                    x: tile!.x,
                    y: tile!.y,
                    index: i,
                    targetTeam: null,
                    target: null,
                };
                this.team?.game.processMagic(data, this.team);
                return spell.castTime * 1000;
            }
        }
        return -1;
    }

    determineTarget() {
        this.setArchetype();
        
        switch (this.AItype) {
            case AIType.Opportunist:
                this.opportunistTarget();
                break;
            case AIType.Hunter:
                this.hunterTarget();
                break;
            case AIType.Equalizer:
                this.equalizerTarget();
                break;
            case AIType.Defender:
                this.defenderTarget();
                break;
            case AIType.Hero:
                this.heroTarget();
            default:
                this.opportunistTarget();
                break;
        }
    }

    getOptimalTarget(targets: ServerPlayer[], comparator: Comparator<ServerPlayer>): ServerPlayer | null {
        let optimalTarget: ServerPlayer | null = null;
        targets.forEach(target => {
            if (!optimalTarget || comparator(target, optimalTarget) > 0) {
                optimalTarget = target;
            }
        });
        return optimalTarget;
    }

    getClosestTarget(targets: ServerPlayer[], from: ServerPlayer = this) {
        let closestTarget: ServerPlayer | null = null;
        targets.forEach(target => {
            if (!closestTarget || this.distanceTo(target.x, target.y) < this.distanceTo(closestTarget.x, closestTarget.y)) {
                closestTarget = target;
            }
        });
        return closestTarget;
    }

    opportunistTarget() {
        let targets = this.team?.game.listAdjacentEnemies(this);
        if (targets?.length === 0) {
            targets = this.team?.game.listAllEnemies(this);
        }
        this.target = this.getClosestTarget(targets!);
        // console.log(`opportunist target: ${this.target!.num} at (${this.target!.x}, ${this.target!.y})`);
    }

    hunterTarget() {
        const targets = this.team?.game.listAllEnemies(this);
        this.target = this.getOptimalTarget(targets!, lowestHpComparator);
    }

    equalizerTarget() {
        const targets = this.team?.game.listAllEnemies(this);
        this.target = this.getOptimalTarget(targets!, highestHpComparator);
    }

    defenderTarget() {
        const allies = this.team?.game.listAllAllies(this);
        if (!allies || allies.length === 0) {
            this.hunterTarget();
            return;
        }
        const ally = this.getOptimalTarget(allies!, lowestHpComparator);
        const targets = this.team?.game.listAllEnemies(this);
        this.target = this.getClosestTarget(targets!, ally!);
    }

    heroTarget() {
        const targets = this.team?.game.listAllEnemies(this);
        this.target = this.getOptimalTarget(targets!, highestDamageComparator);
    }

    attack(target: ServerPlayer) {
        const data = {
            num: this.num,
            target: target.num,
        }
        this.team?.game.processAttack(data, this.team);
    }

    moveTowards(x: number, y: number) {
        const tiles = this.team?.game.listCellsInRange(this.x, this.y, this.distance);
        
        // Find the tile with the lowest distance to (x, y)
        let closestTile = tiles![0];
        if (!closestTile) return;
        let closestDistance = Math.pow(closestTile.x - x, 2) + Math.pow(closestTile.y - y, 2);
        for(let i = 1; i < tiles!.length; i++) {
            const nextTo = (Math.abs(x - tiles![i].x) <= 1 && Math.abs(y - tiles![i].y) <= 1);
            if (nextTo) {
                closestTile = tiles![i];
                break;
            } 
            const distance = Math.pow(tiles![i].x - x, 2) + Math.pow(tiles![i].y - y, 2);
            if (distance < closestDistance) {
                closestTile = tiles![i];
                closestDistance = distance;
            }
        }

        const data = {
            num: this.num,
            tile: closestTile,
        }
        this.team?.game.processMove(data, this.team);
    }
}