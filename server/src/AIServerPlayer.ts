import {damageAmount, effectAmount, reviveAmount, MELEE_POTENCY, POISON_POTENCY, FIRE_POTENCY, supportAmount, STATUS_TURNS, STEAM_MISS_CHANCE} from '@legion/shared/combatBalance';
import { ServerPlayer } from './ServerPlayer';
import { AIAttackMode, Class, Stat, StatusEffect, Target, Terrain } from "@legion/shared/enums";
import { FREEZE_AI, MOVEMENT_RANGE } from "@legion/shared/config";
import { getTilesInHexRadius, hexDistance, isInSpellRange, isSkip, listCellsOnTheWay } from '@legion/shared/utils';
import { SpeedClass } from "@legion/shared/enums";
import type { Spell } from './Spell';
import type { Item } from './Item';

/**
 * Utility AI shared by practice bots, zombie opponents (inactive players' rosters) and Tower
 * enemies. Every turn it scores each available action in HP-equivalent value, then picks the
 * best one. Lower difficulty adds noise to those scores, so weaker opponents misjudge the way a
 * person might instead of doing things no person would (walking a mage into melee, drinking an
 * Ether at full MP).
 */

/** How each character picks the enemy it focuses; fixed for the whole match. */
enum Personality {
    Opportunist, // the closest enemy
    Hunter,      // the most wounded enemy
    Equalizer,   // the healthiest enemy
    Defender,    // the enemy nearest the most wounded ally
    Hero,        // the enemy who has dealt the most damage
}

type ActionKind = 'spell' | 'item' | 'attack' | 'move' | 'pass';
type Plan = { kind: ActionKind; score: number; aoe?: boolean; execute: () => void };

const DOT_PER_TURN: Partial<Record<StatusEffect, number>> = { [StatusEffect.POISON]: POISON_POTENCY, [StatusEffect.BURN]: FIRE_POTENCY };
// Consumables are scarce: an item must clearly beat this before the AI spends it.
const ITEM_COST = 12;
const MP_VALUE = 0.25;
const KILL_BONUS = 30;
const FRIENDLY_FIRE_WEIGHT = 1.5;
// Turns beyond this are discounted: most fights are decided sooner.
const STATUS_HORIZON = 4;
const MAX_NOISE = 45;

function gaussian() {
    return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}

export class AIServerPlayer extends ServerPlayer {
    personality: Personality = Personality.Opportunist;
    target: ServerPlayer | null = null;
    canUseItems: boolean = true;
    canUseStatusEffects: boolean = true;
    bannedSpells: number[] = [];
    isZombie: boolean = false;
    private plan: Plan | null = null;

    attackMode: AIAttackMode = AIAttackMode.IDLE;
    actionCount: number = 0;

    constructor(num: number, name: string, frame: string, x: number, y: number) {
        super(num, name, frame, x, y);
        const personalities = [Personality.Opportunist, Personality.Hunter, Personality.Equalizer, Personality.Defender, Personality.Hero];
        this.personality = personalities[Math.floor(Math.random() * personalities.length)];
    }

    setAttackMode(attackMode: AIAttackMode) {
        this.attackMode = attackMode;
    }

    setZombie(isZombie: boolean) {
        this.isZombie = isZombie;
    }

    /** 0 (clumsy) to 1 (sharp), from the difficulty tier set by AIGame/TowerGame. */
    getIQ() {
        const ratio = this.team?.teamData.AIwinRatio;
        return Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0.5;
    }

    get game() {
        return this.team!.game;
    }

    takeAction(): number {
        if (!this.canAct()) return 0;
        const ranked = this.plan ? [this.plan, ...this.rankPlans()] : this.rankPlans();
        this.plan = null;
        // A plan can be refused (for example a tile that just became occupied): fall back in order.
        for (const plan of ranked) {
            plan.execute();
            if (this.hasActed) break;
        }
        if (!this.hasActed) this.game.processPassTurn();
        this.actionCount++;
        return 0;
    }

    /** All options, best first after difficulty noise; never includes clearly harmful moves. */
    rankPlans(): Plan[] {
        this.refreshFocus();
        const plans = [...this.spellPlans(), ...this.itemPlans(), ...this.attackPlans(), ...this.movePlans()]
            .filter(plan => plan.score > 0);
        plans.push({ kind: 'pass', score: 0, execute: () => this.game.processPassTurn() });
        const iq = this.getIQ();
        const noise = (1 - iq) * MAX_NOISE;
        const best = Math.max(...plans.map(plan => plan.score));
        // Weaker opponents settle for modest options more often, but never for harmful ones.
        const floor = best * (0.15 + 0.35 * iq);
        return plans
            .map(plan => ({ plan, value: plan.score >= floor ? plan.score + gaussian() * noise : plan.score - 1000 }))
            .sort((a, b) => b.value - a.value)
            .map(({ plan }) => plan);
    }

    // ---- Targeting -------------------------------------------------------------------------

    private enemies() {
        return this.game.listAllEnemies(this);
    }

    private allies() {
        return this.team!.getMembers();
    }

    private enemiesCastIce() {
        return this.enemies().some(enemy => enemy.spells.some(spell => spell.terrain === Terrain.ICE));
    }

    /** Keep one focus target until it falls; the personality decides who that is. */
    private refreshFocus() {
        if (this.target?.isAlive()) return;
        const enemies = this.enemies();
        if (!enemies.length) { this.target = null; return; }
        const ratio = (player: ServerPlayer) => player.hp / player.getMaxHP();
        const by = (key: (player: ServerPlayer) => number) => enemies.reduce((best, enemy) => key(enemy) < key(best) ? enemy : best);
        switch (this.personality) {
            case Personality.Hunter: this.target = by(ratio); break;
            case Personality.Equalizer: this.target = by(enemy => -ratio(enemy)); break;
            case Personality.Hero: this.target = by(enemy => -enemy.damageDealt); break;
            case Personality.Defender: {
                const wounded = this.allies().filter(ally => ally.isAlive()).reduce((best, ally) => ratio(ally) < ratio(best) ? ally : best, this);
                this.target = by(enemy => hexDistance(enemy.x, enemy.y, wounded.x, wounded.y));
                break;
            }
            default: this.target = by(enemy => hexDistance(this.x, this.y, enemy.x, enemy.y));
        }
    }

    /** Rough damage a character threatens per turn: what disabling or killing it is worth. */
    private threat(player: ServerPlayer) {
        const melee = damageAmount(MELEE_POTENCY, player.level, player.getStat(Stat.ATK), 10);
        const magic = Math.max(0, ...player.spells.filter(spell => spell.cost <= player.mp && !player.isMuted())
            .flatMap(spell => spell.effects.filter(effect => effect.stat === Stat.HP && effect.value < 0)
                .map(effect => damageAmount(-effect.value, player.level, player.getStat(Stat.SPATK), 10))));
        return Math.max(8, melee, magic);
    }

    private enemyWeight(enemy: ServerPlayer) {
        let weight = 1;
        if (enemy === this.target) weight += 0.25;
        if (enemy.class === Class.WHITE_MAGE) weight += 0.15;
        return weight;
    }

    // ---- Valuing effects ---------------------------------------------------------------------

    private damageValue(target: ServerPlayer, damage: number) {
        // Ice shields a frozen character from everything but poison.
        if (!target.isAlive() || target.isFrozen()) return 0;
        const dealt = Math.min(damage, target.hp);
        const kills = damage >= target.hp;
        if (target.team === this.team) return -(dealt * FRIENDLY_FIRE_WEIGHT + (kills ? 60 : 0));
        return dealt * this.enemyWeight(target) + (kills ? KILL_BONUS + this.threat(target) : 0);
    }

    private healValue(target: ServerPlayer, amount: number) {
        if (!target.isAlive()) return 0;
        const missing = target.getMaxHP() - target.hp;
        const ratio = target.hp / target.getMaxHP();
        const urgency = ratio < 0.35 ? 1.6 : ratio < 0.6 ? 1.1 : 0.3;
        const value = Math.min(amount, missing) * urgency;
        return target.team === this.team ? value : -value;
    }

    private reviveValue(target: ServerPlayer, restoredHP: number) {
        if (target.isAlive()) return 0;
        const value = 45 + restoredHP;
        return target.team === this.team ? value : -value;
    }

    /** Worth of `turns` of a status on `target`; positive when it helps this AI's side. */
    private statusValue(status: StatusEffect, target: ServerPlayer, turns: number, scaled = false) {
        if (!target.isAlive()) return 0;
        if (status === StatusEffect.FREEZE) {
            if (target.isFreezeImmune()) return 0;
            turns = Math.min(turns, target.freezeTurns());
        }
        const effective = turns === -1 ? STATUS_HORIZON : Math.min(turns, STATUS_HORIZON);
        // Refreshing a duration has less value than disabling a new target.
        const stacked = target.hasStatusEffect(status) ? 0.35 : 1;
        let value = 0;
        switch (status) {
            case StatusEffect.PARALYZE:
            case StatusEffect.FREEZE:
            case StatusEffect.SLEEP:
                value = effective * this.threat(target) * 0.8;
                break;
            case StatusEffect.MUTE:
                value = target.isMage() && target.mp > 0 ? effective * this.threat(target) * 0.7 : 2;
                break;
            case StatusEffect.POISON:
            case StatusEffect.BURN:
                value = Math.min(effective * (scaled
                    ? supportAmount(DOT_PER_TURN[status], this.level, this.getStat(Stat.SPATK))
                    : DOT_PER_TURN[status]), target.hp);
                break;
            case StatusEffect.HASTE:
                value = this.enemies().length ? 15 : 0;
                return target.team === this.team ? value : -value;
        }
        value *= stacked;
        return target.team === this.team ? -value : value;
    }

    /** Thawing frees whoever is held, friend or foe. */
    private thawValue(target: ServerPlayer) {
        if (!target.isAlive() || !target.isFrozen()) return 0;
        const value = Math.min(target.statuses[StatusEffect.FREEZE], STATUS_HORIZON) * this.threat(target) * 0.8;
        return target.team === this.team ? value : -value;
    }

    /** Guarding a tile against ice only matters when the other side can cast it. */
    private warmthValue(target: ServerPlayer, turns: number) {
        if (!target.isAlive() || target.isFreezeImmune() || !this.enemiesCastIce()) return 0;
        const value = Math.min(turns, STATUS_HORIZON) * 3;
        return target.team === this.team ? value : -value;
    }

    /** Ice traps whoever stands on the tile; flames hurt whoever stays. */
    private terrainValue(terrain: Terrain, targets: ServerPlayer[]) {
        let value = 0;
        for (const target of targets) {
            if (terrain === Terrain.ICE) value += this.statusValue(StatusEffect.FREEZE, target, STATUS_TURNS[StatusEffect.FREEZE]);
            if (terrain === Terrain.FIRE) {
                const damage = Math.min(target.hp, supportAmount(FIRE_POTENCY, this.level, this.getStat(Stat.SPATK)));
                value += target.team === this.team ? -damage * FRIENDLY_FIRE_WEIGHT : damage;
            }
        }
        return value;
    }

    // ---- Spells --------------------------------------------------------------------------------

    private castableSpells() {
        if (this.isMuted()) return [];
        return this.spells
            .map((spell, index) => ({ spell, index }))
            .filter(({ spell }) => spell.cost <= this.mp && !this.bannedSpells.includes(spell.id)
                && (this.canUseStatusEffects || !spell.isStatusEffectSpell()));
    }

    private spellValue(spell: Spell, targets: ServerPlayer[]) {
        let value = 0;
        for (const target of targets) {
            for (const effect of spell.effects) {
                if (effect.stat !== Stat.HP) continue;
                if (effect.onKO) value += this.reviveValue(target, effectAmount(effect, this, target));
                else if (effect.value < 0) value += this.damageValue(target, effectAmount(effect, this, target));
                else value += this.healValue(target, effectAmount(effect, this, target));
            }
            if (spell.warmth) value += this.thawValue(target) + this.warmthValue(target, spell.warmth);
            if (spell.status) value += spell.status.chance * this.statusValue(spell.status.effect, target, spell.status.duration, true);
        }
        if (spell.terrain !== Terrain.NONE) value += this.terrainValue(spell.terrain, targets);
        return value - spell.cost * MP_VALUE;
    }

    private spellPlans(): Plan[] {
        const plans: Plan[] = [];
        for (const { spell, index } of this.castableSpells()) {
            if (spell.target === Target.SINGLE) {
                const everyone = [...this.allies(), ...this.game.getOtherTeam(this.team!.id).getMembers()];
                for (const target of everyone) {
                    if (!spell.isApplicable(target) || !isInSpellRange(this.x, this.y, target.x, target.y)) continue;
                    const score = this.spellValue(spell, [target]);
                    plans.push({ kind: 'spell', score, execute: () => this.game.processMagic({ x: target.x, y: target.y, index, targetTeam: target.team.id, target: target.num }) });
                }
            } else if (spell.target === Target.AOE) {
                for (const tile of this.aoeCenters(spell.radius - 1, spell.warmth ? this.allies() : this.enemies())) {
                    const targets = this.game.getPlayersInArea(tile.x, tile.y, spell.radius - 1);
                    if (!targets.length) continue;
                    const score = this.spellValue(spell, targets);
                    plans.push({ kind: 'spell', aoe: true, score, execute: () => this.game.processMagic({ x: tile.x, y: tile.y, index, targetTeam: null, target: null }) });
                }
            }
        }
        return plans;
    }

    /** Tiles in casting range that would catch at least one of `around` (enemies by default) in an area of `radius`. */
    private aoeCenters(radius: number, around = this.enemies()) {
        const seen = new Set<string>();
        const tiles: { x: number; y: number }[] = [];
        for (const character of around) {
            for (const tile of getTilesInHexRadius(character.x, character.y, radius)) {
                const key = `${tile.x},${tile.y}`;
                if (seen.has(key) || isSkip(tile.x, tile.y) || !isInSpellRange(this.x, this.y, tile.x, tile.y)) continue;
                seen.add(key);
                tiles.push(tile);
            }
        }
        return tiles;
    }

    // ---- Consumables ---------------------------------------------------------------------------

    private itemValue(item: Item, target: ServerPlayer) {
        if (item.noEffectReason(target)) return -Infinity;
        let value = 0;
        for (const effect of item.effects) {
            if (effect.stat === Stat.HP) {
                if (effect.onKO) value += this.reviveValue(target, reviveAmount(effect, target.getMaxHP()));
                else value += this.healValue(target, effect.value === -1 ? target.getMaxHP() : effect.value);
            } else if (effect.stat === Stat.MP) {
                value += this.manaValue(target, effect.value === -1 ? target.getMaxMP() : effect.value);
            }
        }
        for (const status of item.statusRemovals) {
            if (target.hasStatusEffect(status)) value -= this.statusValue(status, target, target.statuses[status]);
        }
        if (item.status) value += item.status.chance * this.statusValue(item.status.effect, target, item.status.duration);
        return value - ITEM_COST;
    }

    /** MP only matters to casters, and most when it stands between them and their spells. */
    private manaValue(target: ServerPlayer, amount: number) {
        if (!target.isAlive() || target.team !== this.team || !target.spells.length) return 0;
        const restored = Math.min(amount, target.getMaxMP() - target.mp);
        const cheapest = Math.min(...target.spells.map(spell => spell.cost));
        const need = target.mp < cheapest ? 2.5 : target.mp < cheapest * 2 ? 1 : 0.3;
        return restored * 0.5 * need;
    }

    private itemPlans(): Plan[] {
        if (!this.canUseItems) return [];
        const plans: Plan[] = [];
        this.inventory.forEach((item, index) => {
            if (item.target === Target.SELF) {
                plans.push({ kind: 'item', score: this.itemValue(item, this), execute: () => this.game.processUseItem({ x: this.x, y: this.y, index, targetTeam: null, target: null }) });
            } else if (item.target === Target.SINGLE) {
                for (const ally of this.allies()) {
                    if (!isInSpellRange(this.x, this.y, ally.x, ally.y)) continue;
                    plans.push({ kind: 'item', score: this.itemValue(item, ally), execute: () => this.game.processUseItem({ x: ally.x, y: ally.y, index, targetTeam: ally.team.id, target: ally.num }) });
                }
            } else if (item.target === Target.AOE) {
                for (const ally of this.allies().filter(ally => isInSpellRange(this.x, this.y, ally.x, ally.y))) {
                    const targets = this.game.getPlayersInArea(ally.x, ally.y, item.radius ?? 1);
                    const score = targets.reduce((sum, target) => sum + Math.max(0, this.itemValue(item, target) + ITEM_COST), 0) - ITEM_COST;
                    plans.push({ kind: 'item', score, execute: () => this.game.processUseItem({ x: ally.x, y: ally.y, index, targetTeam: null, target: null }) });
                }
            }
        });
        return plans;
    }

    // ---- Melee ---------------------------------------------------------------------------------

    private meleeDamage(target: ServerPlayer) {
        return this.game.calculateDamage(this, target);
    }

    private attackPlans(): Plan[] {
        const weapon = this.getWeapon();
        return this.game.listAdjacentEnemies(this).map(enemy => {
            // Hitting a frozen enemy deals nothing and breaks them free.
            let score = enemy.isFrozen() ? this.thawValue(enemy) : this.damageValue(enemy, this.meleeDamage(enemy));
            for (const status of weapon?.statusEffects ?? []) score += status.chance * this.statusValue(status.effect, enemy, status.duration);
            if (this.game.terrainManager.hasSteam(enemy.x, enemy.y)) score *= 1 - STEAM_MISS_CHANCE;
            return { kind: 'attack' as const, score, execute: () => this.attack(enemy) };
        });
    }

    attack(target: ServerPlayer) {
        this.game.processAttack({ target: target.num, sameTeam: target.team.id === this.team!.id });
    }

    // ---- Positioning ---------------------------------------------------------------------------

    /** Casters with spells they can afford fight from range; everyone else closes in. */
    private isRanged() {
        if (!this.isMage()) return false;
        const affordable = this.castableSpells().length > 0;
        const ether = this.canUseItems && this.inventory.some(item => item.effects.some(effect => effect.stat === Stat.MP));
        return affordable || ether;
    }

    private positionValue(x: number, y: number) {
        const enemies = this.enemies();
        if (!enemies.length) return 0;
        // Ending in fire risks another exposure on each subsequent activation.
        let value = this.game.checkIsOnFlame(x, y) ? -2 * (this.game.terrainManager.fireDamage.get(`${x},${y}`) ?? FIRE_POTENCY) : 0;
        if (this.isRanged()) {
            const inRange = enemies.filter(enemy => isInSpellRange(x, y, enemy.x, enemy.y));
            if (inRange.length) value += 8;
            if (this.target && inRange.includes(this.target)) value += 6;
            for (const enemy of enemies) {
                const distance = hexDistance(x, y, enemy.x, enemy.y);
                if (distance <= 1) value -= 18;
                else if (distance <= MOVEMENT_RANGE + 1 && !enemy.isMage()) value -= 5;
            }
            const nearest = Math.min(...enemies.map(enemy => hexDistance(x, y, enemy.x, enemy.y)));
            value -= Math.abs(nearest - 5);
            if (this.class === Class.WHITE_MAGE) {
                value += 4 * this.allies().filter(ally => ally !== this && ally.isAlive() && ally.hp < ally.getMaxHP() * 0.6 && isInSpellRange(x, y, ally.x, ally.y)).length;
            }
        } else {
            const focus = this.target ?? enemies[0];
            const distance = hexDistance(x, y, focus.x, focus.y);
            value -= distance * 6;
            if (distance <= 1) value += 10;
            // Stand near our casters so threats reach the warrior first.
            if (this.allies().some(ally => ally !== this && ally.isAlive() && ally.isMage() && hexDistance(x, y, ally.x, ally.y) <= 2)) value += 3;
        }
        return value;
    }

    private movePlans(): Plan[] {
        const here = this.positionValue(this.x, this.y);
        return this.game.listCellsInRange(this.x, this.y, this.distance).map(tile => {
            const flame = [...listCellsOnTheWay(this.x, this.y, tile.x, tile.y)]
                .find(cell => this.game.terrainManager.terrainMap.get(cell) === Terrain.FIRE);
            const exposure = flame ? this.game.terrainManager.fireDamage.get(flame) ?? FIRE_POTENCY : 0;
            const score = this.positionValue(tile.x, tile.y) - here - exposure - 1;
            return { kind: 'move' as const, score, execute: () => this.game.processMove({ tile }) };
        });
    }

    // ---- Turn flow -----------------------------------------------------------------------------

    /** How long a person would plausibly take for this decision (zombies only pose as people). */
    private thinkTime(plan: Plan | null) {
        if (!this.isZombie) return 1000 + Math.random() * 1000;
        const ranges: Record<ActionKind, [number, number]> = {
            pass: [900, 1800], move: [900, 2000], attack: [1000, 2200], item: [1400, 2600], spell: [1600, 3000],
        };
        const [min, max] = ranges[plan?.kind ?? 'move'];
        let delay = min + Math.random() * (max - min);
        if (plan?.aoe) delay += 600 + Math.random() * 800;
        if (this.actionCount === 0) delay += 1500;
        return Math.round(delay);
    }

    startTurn() {
        super.startTurn();
        if (FREEZE_AI) {
            this.game.turnSystem.processAction(this, SpeedClass.SLOW);
            this.game.processTurn();
            return;
        }
        this.plan = this.canAct() ? this.rankPlans()[0] ?? null : null;
        this.game.combatClock.schedule(() => {
            if (this.game.turnee === this && !this.hasActed) this.takeAction();
        }, this.thinkTime(this.plan));
    }
}
