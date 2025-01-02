import { ServerPlayer, ActionType } from './ServerPlayer';
import { AIAttackMode, PlayMode, StatusEffect, Target } from "@legion/shared/enums";
import { INITIAL_COOLDOWN } from "@legion/shared/config";


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
    canUseItems: boolean = true;
    canUseStatusEffects: boolean = true;
    bannedSpells: number[] = [];
    healRandomThreshold: number = 1.0;

    attackMode: AIAttackMode = AIAttackMode.IDLE;
    actionCount: number = 0;
    
    constructor(num: number, name: string, frame: string, x: number, y: number) {
        super(num, name, frame, x, y);

        this.setArchetype();

        // Assign a random value between 1 and 10 to retargetCount
        this.retargetRate = Math.floor(Math.random() * 10) + 1;
        this.retargetCount = this.retargetRate;
    }

    setAttackMode(attackMode: AIAttackMode) {
        this.attackMode = attackMode;
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

    hasValidTarget() {
        return this.target && this.target.isAlive();
    }

    takeAction(): number {
        // console.log(`[AIServerPlayer:takeAction] ${this.name} is taking action`);
        if (this.team?.game.isTutorial()) {
            if (this.attackMode === AIAttackMode.IDLE) {
                // console.log(`[AIServerPlayer:takeAction] ${this.name} is idle`);
                return 0;
            }
            if (this.actionCount > 0 && this.attackMode === AIAttackMode.ATTACK_ONCE) {
                console.log(`[AIServerPlayer:takeAction] ${this.name} can act onlyonce`);
                return 0;
            }
        }

        if (!this.canAct()) {
            // console.log(`[AIServerPlayer:takeAction] ${this.name} cannot act`);
            return 0;
        }

        if (this.getIQ() > 0.4) {
            if (this.team?.game.checkIsOnFlame(this.x, this.y)) {
                console.log(`[AIServerPlayer:takeAction] ${this.name} is on fire`);
                const cell = this.team?.game.findFreeCellNear(this.x, this.y, true);
                if (cell) {
                    this.moveTowards(cell.x, cell.y);
                    this.handleActionTaken();
                    return 0;
                }
            }
        }

        // Try to use an item
        if (this.checkForItemUse()) {
            this.handleActionTaken();
            return 0;
        }
        
        // Try to use a spell
        const spellDelay = this.checkForSpellUse();
        if (spellDelay > -1) {
            this.handleActionTaken();
            return spellDelay;
        }

        // Try to attack or move
        if (!this.hasValidTarget()) {
            this.determineTarget();
        }
        
        if (!this.target) {
            // console.log(`[AIServerPlayer:takeAction] ${this.name} has no valid target`);
            return 0;
        }

        if (this.isNextTo(this.target.x, this.target.y)) {
            // console.log(`[AIServerPlayer:takeAction] ${this.name} is next to target`);
            this.attack(this.target);
        } else {
            // console.log(`[AIServerPlayer:takeAction] ${this.name} is not next to target`);
            this.moveTowards(this.target.x, this.target.y);
        }

        this.handleActionTaken();
        return 0;
    }

    private handleActionTaken() {
        this.actionCount++;
        this.retargetCount--;
        if (this.retargetCount <= 0) {
            this.target = null;
            this.retargetCount = this.retargetRate;
        }
    }

    checkForItemUse() {
        // console.log(`[AIServerPlayer:checkForItemUse] Checking for items among ${this.inventory.map(item => item.id)}`);
        if (!this.canUseItems) {
            // console.log(`[AIServerPlayer:checkForItemUse] ${this.name} cannot use items`);
            return false;
        }
        for (let i = 0; i < this.inventory.length; i++) {
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

    checkForSpellUse(): number {
        // console.log(`[AIServerPlayer:checkForSpellUse] Checking for spells among ${this.spells.map(spell => spell.id)}`);
        let delay = -1;
        // Randomize the order of spells
        const spells = this.spells.sort(() => Math.random() - 0.5);
        for (let i = 0; i < spells.length; i++) {
            const spell = spells[i];
            // console.log(`[AIServerPlayer:checkForSpellUse] Checking spell ${spell.name}`);
            if (this.bannedSpells.includes(spell.id)) continue;
            if (spell.isStatusEffectSpell() && !this.canUseStatusEffects) continue;
            // console.log(`[AIServerPlayer:checkForSpellUse] Checking spell ${spell.id}`);
            if (spell.cost > this.mp) {
                // console.log(`[AIServerPlayer:checkForSpellUse] Spell ${spell.id} costs ${spell.cost} MP, which is more than the AI has`);
                continue;
            }

            // TODO: replace by checks on spell properties
            switch (spell.id) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                case 8:
                    delay = this.checkForAoE(i);
                    if (delay > -1) return delay;
                    break;
                case 9:
                    delay = this.checkForHealUse(i);
                    if (delay > -1) return delay;
                    break;
                case 10:
                case 11:
                    delay = this.checkForStatusEffectUse(i);
                    if (delay > -1) return delay;
                    break;
                default:
                    console.log(`[AIServerPlayer:checkForSpellUse] Unknown spell ID: ${spell.id}`);
                    continue;
            }
        }
        return delay;
    }

    checkForHealUse(index: number): number {
        const spell = this.spells[index];
        if (spell.target != Target.SINGLE) return -1;
        if (!spell.isHealingSpell()) return -1;
        if (Math.random() > this.healRandomThreshold) return -1;

        const allies = this.team?.game.listAllAllies(this);
        if (!allies || allies.length === 0) return -1;
        const ally = this.getOptimalTarget(allies!, lowestHpComparator);
        if (!ally) return -1;

        const healAmount = spell.getHealAmount();
        if (ally.hp <= (ally.getMaxHP() - healAmount)) {
            const data = {
                num: this.num,
                x: ally.x,
                y: ally.y,
                index,
                targetTeam: ally.team.id,
                target: ally.num,
            };
            this.team?.game.processMagic(data, this.team);
            return spell.castTime * 1000;
        }
        return -1;
    }

    checkForAoE(index: number): number {
        if (Math.random() < 0.4) return -1;

        const spell = this.spells[index];
        if (spell.target != Target.AOE) return -1;

        const tile = this.team?.game.scanGridForAoE(this, spell.size, spell.size - 1);
        if (tile) {
            const data = {
                num: this.num,
                x: tile!.x,
                y: tile!.y,
                index,
                targetTeam: null,
                target: null,
            };
            this.team?.game.processMagic(data, this.team);
            return spell.castTime * 1000;
        }
        return -1;
    }

    checkForStatusEffectUse(index: number): number {
        if (Math.random() < 0.4) return -1;
        const spell = this.spells[index];
        console.log(`[AIServerPlayer:checkForStatusEffectUse] Checking for status effect use: ${spell.status.effect}`);

        let targets = this.team?.game.listAllEnemies(this);
        if (spell.status.effect === StatusEffect.MUTE) {
            // Filter to keep only mages
            targets = targets.filter(target => target.isMage());
        }
        if (!targets || targets.length === 0) return -1;
        // Find the first target that is not afflicted by the status effect
        const target = targets.find(target => !target.hasStatusEffect(spell.status.effect)); 
        
        if (target) {
            const data = {
                num: this.num,
                x: target.x,
                y: target.y,
                index,
                targetTeam: target.team.id,
                target: target.num,
            };
            this.team?.game.processMagic(data, this.team);
            return spell.castTime * 1000;
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
            sameTeam: target.team.id === this.team!.id,
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

    getIQ() {
        return this.team?.teamData.AIwinRatio;
    }
}
