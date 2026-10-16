import {balanceCharacter} from '@legion/shared/characterBalance';
import {FIRE_POTENCY, POISON_POTENCY, STATUS_TURNS, supportAmount, spBudget} from '@legion/shared/combatBalance';
import { Team } from './Team';
import { Item } from './Item';
import { Spell } from './Spell';
import { Stat, Terrain, StatusEffect, Class, SpeedClass } from "@legion/shared/enums";
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { getMaxStatValue, getXPThreshold } from '@legion/shared/levelling';
import { CharacterStats, Equipment, PlayerNetworkData, StatusEffects } from '@legion/shared/interfaces';
import { INJURED_MODE, LOTSA_HP, MOVEMENT_RANGE, PARALYZED_DELAY, XP_CONTRIBUTION_PER_HP_BAR, XP_CONTRIBUTION_TARGET_CAP } from "@legion/shared/config";
import { getEquipmentById } from '@legion/shared/Equipments';
import { getSpells, lvlUp, setUpInventory } from '@legion/shared/NewCharacter';
import { hexDistance } from '@legion/shared/utils';


const terrainDot = {
    [Terrain.FIRE]: FIRE_POTENCY,
}

const statusDot = {
    [StatusEffect.POISON]: POISON_POTENCY,
    [StatusEffect.BURN]: FIRE_POTENCY,
}

const DoTStatuses = [StatusEffect.POISON, StatusEffect.BURN];
const DoTTerrains = [Terrain.FIRE];

export type ActionType = 'move' | 'attack';
export class ServerPlayer {
    dbId: string;
    num;
    name;
    frame;
    x;
    y;
    team: Team | null = null;
    level: number = 1;
    xp: number = 0;
    earnedStatsPoints: number = 0;
    earnedXP: number = 0;
    levelsGained: number = 0;
    _hp: number = 0;
    _mp: number = 0;
    justDied: boolean = false;
    stats: CharacterStats;
    stats_modifiers: CharacterStats;
    hp;
    mp;
    distance;
    inventoryCapacity: number = 3;
    inventory: Item[] = [];
    spells: Spell[] = [];
    spell_slots: number = 0;
    equipment: Equipment;
    isCasting: boolean = false;
    damageDealt: number = 0;
    entranceTime: number = 2.5;
    statuses: StatusEffects;
    interactedTargets: Set<ServerPlayer> = new Set();
    /** Actions taken and damage absorbed; sets the contribution part of the XP share. */
    contribution = 0;
    activeTerrainDoT: Terrain | null = null;
    class: Class;
    isAI = false;
    hasActed: boolean = false;
    private activationStatuses: StatusEffect[] = [];
    private statusDamage: Partial<Record<StatusEffect, number>> = {};

    constructor(num: number, name: string, frame: string, x: number, y: number) {
        this.num = num;
        this.name = name;
        this.frame = frame;
        this.x = x;
        this.y = y;
        this.distance = MOVEMENT_RANGE;

        this.statuses = {
            [StatusEffect.FREEZE]: 0,
            [StatusEffect.PARALYZE]: 0,
            [StatusEffect.POISON]: 0,
            [StatusEffect.BURN]: 0,
            [StatusEffect.SLEEP]: 0,
            [StatusEffect.MUTE]: 0,
            [StatusEffect.HASTE]: 0,
        };

        this.stats = {
            [Stat.HP]: 0,
            [Stat.MP]: 0,
            [Stat.ATK]: 0,
            [Stat.DEF]: 0,
            [Stat.SPATK]: 0,
            [Stat.SPDEF]: 0,
            [Stat.SPEED]: 0,
        };

        this.stats_modifiers = {
            [Stat.HP]: 1,
            [Stat.MP]: 1,
            [Stat.ATK]: 1,
            [Stat.DEF]: 1,
            [Stat.SPATK]: 1,
            [Stat.SPDEF]: 1,
            [Stat.SPEED]: 1,
        };
    }

    getPlacementData(includePersonal = false): PlayerNetworkData {
        const data: PlayerNetworkData = {
            name: this.name,
            portrait: this.frame,
            x: this.x,
            y: this.y,
            hp: this.hp,
            maxHP: this.getStat(Stat.HP),
            mp: this.mp,
            maxMP: this.getStat(Stat.MP),
            statuses: this.statuses,
            class: this.class,
            level: this.level,
            combatStats: Object.fromEntries(Object.keys(this.stats).map(stat => [stat, this.getStat(Number(stat) as Stat)])) as CharacterStats,
            spellEffects: Object.fromEntries(this.spells.map(spell => [spell.id, spell.effects])),
            // Existing installed clients already consume this cost override outside Tower too.
            towerSpellCosts: Object.fromEntries(this.spells.map(spell => [spell.id, spell.cost])),
            // Both teams need spell effects loaded before combat or a summoned unit acts.
            spells: this.getNetworkSpells(),
        }
        if (includePersonal) {
            data['distance'] = this.distance;
            data['inventory'] = this.getNetworkInventory();
            data['xp'] = this.xp;
            data['isPlayer'] = includePersonal;
        }
        return data;
    }

    getNetworkInventory(): number[] {
        // Return the id's if the Items in this.inventory
        return this.inventory.map(item => item.id);
    }

    getNetworkSpells(): number[] {
        return this.spells.map(spell => spell.id);
    }

    setCasting(casting: boolean) {
        this.isCasting = casting;
    }

    isFrozen() {
        return this.statuses[StatusEffect.FREEZE] !== 0;
    }

    isParalyzed() {
        return (this.statuses[StatusEffect.PARALYZE] !== 0) || this.isFrozen();
    }

    isHasted() {
        return this.statuses[StatusEffect.HASTE] !== 0;
    }

    isMuted() {
        return this.statuses[StatusEffect.MUTE] !== 0;
    }

    canAct() {
        return this.isAlive() && !this.isParalyzed();
    }

    canMoveTo(x: number, y: number) {
        if (!this.canAct()) return false;

        const distance = hexDistance(this.x, this.y, x, y);
        return distance <= this.distance;
    }

    isNextTo(x: number, y: number) {
        return hexDistance(this.x, this.y, x, y) <= 1;
    }

    isInArea(x: number, y: number, radius: number) {
        // Use the proper hex distance calculation
        return hexDistance(this.x, this.y, x, y) <= radius;
    }

    isAlive() {
        return this.hp > 0;
    }

    isDead() {
        return !this.isAlive();
    }

    updatePos(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    distanceTo(x: number, y: number) {
        return Math.sqrt(Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2));
    }

    takeDamage(damage: number) {
        if(this.isDead()) return;
        this.justDied = false;

        const hpBefore = this.hp;
        this.updateHP(damage);
        // Taking hits for the team counts toward the XP share, not only dealing them.
        this.contribution += Math.max(0, hpBefore - this.hp) / this.getMaxHP() * XP_CONTRIBUTION_PER_HP_BAR;
        if (this.isDead()) {
            this.die();
        }

        this.team!.game.checkFirstBlood(this.team);
    }

    die() {
        this.justDied = true;
        this.clearStatusEffects();
        this.team!.game.handleTeamKill(this.team);
        this.team!.game.processDeath(this);
    }

    heal(amount: number) {
        this.updateHP(-amount);
    }

    updateHP(amount: number) {
        this._hp = this.hp;
        this.hp -= Math.round(amount);
        this.hp = Math.max(Math.min(Math.round(this.hp), this.getStat(Stat.HP)), 0);

        if (this.HPHasChanged()){
            this.broadcastHPChange();
        }
    }

    broadcastHPChange() {
        this.team!.game.broadcastHPchange(this.team, this.num, this.hp, this.getHPDelta());
    }

    broadcastStatusEffectChange() {
        this.team!.game.broadcastStatusEffectChange(this.team, this.num, this.statuses);
    }

    getHPDelta() {
        return this.hp - this._hp;
    }

    getMaxHP() {
        return LOTSA_HP ? 1000 : this.getStat(Stat.HP);
    }

    getMaxMP() {
        return this.getStat(Stat.MP);
    }

    getHPratio() {
        return this.hp / this.getMaxHP();
    }

    getPreviousHPRatio() {
        return this._hp / this.getMaxHP();
    }

    resetPreviousHP() {
        this._hp = this.hp;
    }

    HPHasChanged() {
        return this._hp !== this.hp;
    }

    MPHasChanged() {
        return this._mp !== this.mp;
    }

    consumeMP(amount: number) {
        this._mp = this.mp;
        this.mp = Math.round(this.mp - amount);
        if (this.mp < 0) {
            this.mp = 0;
        }
        return this.mp;
    }

    restoreMP(amount: number) {
        this._mp = this.mp;
        this.mp = Math.round(this.mp + amount);
        if (this.mp > this.getMaxMP()) {
            this.mp = this.getMaxMP();
        }
        return this.mp;
    }

    hasStatusEffect(status: StatusEffect) {
        return this.statuses[status] !== 0;
    }

    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    setLevel(level: number) {
        this.level = level;
    }

    setHP(hp: number) {
        this.setStat(Stat.HP, hp);
        this.hp = Math.round(INJURED_MODE ? this.getMaxHP() / 2 : this.getMaxHP());
        this._hp = this.getMaxHP();
    }

    getHP() {
        return this.hp;
    }

    getLevel() {
        return this.level;
    }

    setMP(mp: number) {
        this.setStat(Stat.MP, mp);
        this.mp = this.getMaxMP();
    }

    getMP() {
        return this.mp;
    }

    getFullStatValue(data, stat) {
        return data.stats[stat] + data.equipment_bonuses[stat] + data.sp_bonuses[stat];
    }

    setUpCharacter(data, isAI = false, preserveStats = false) {
        if (!isAI && !preserveStats) data = balanceCharacter(data);
        console.log(`[ServerPlayer:setUpCharacter] ${this.name} set up with data: ${JSON.stringify(data)}`);
        // console.log(`[ServerPlayer:setUpCharacter] Spells: ${JSON.stringify(data.skills)}`);
        this.setHP(this.getFullStatValue(data, "hp"));
        this.setMP(this.getFullStatValue(data, "mp"));
        this.setStat(Stat.ATK, this.getFullStatValue(data, "atk"));
        this.setStat(Stat.DEF, this.getFullStatValue(data, "def"));
        this.setStat(Stat.SPDEF, this.getFullStatValue(data, "spdef"));
        this.setStat(Stat.SPATK, this.getFullStatValue(data, "spatk"));
        this.setStat(Stat.SPEED, this.getFullStatValue(data, "speed"));
        console.log(`[ServerPlayer:setUpCharacter] Stats: ${JSON.stringify(this.stats)}`);
        this.setInventory(data.carrying_capacity, data.inventory);
        this.setEquipment(data.equipment);
        this.setSpells(data.skill_slots, isAI
            ? data.skills.filter((id: number) => getSpellById(id)?.minLevel <= data.level)
            : data.skills);
        this.level = data.level;
        this.xp = data.xp;
        this.class = data.class;
        this.dbId = data.id;
        this.isAI = isAI;
    }

    setStat(stat: Stat, value: number) {
        if (stat === Stat.NONE) {
            throw new Error('Cannot set NONE stat');
        }
        this.stats[stat] = value;
    }

    setStatsModifier(stat: Stat, value: number) {
        if (stat === Stat.NONE) {
            throw new Error('Cannot set NONE stat');
        }
        this.stats_modifiers[stat] = value;
    }

    getStat(stat: Stat) {
        if (stat === Stat.NONE) return 0;
        const value = Math.min(this.stats[stat] * this.stats_modifiers[stat], getMaxStatValue(stat)) || 0;
        return Math.max(stat === Stat.HP ? 1 : 0, Math.round(value));
    }

    setTeam(team: Team) {
        this.team = team;
    }

    setInventory(capacity: number, inventory: number[]) {
        this.inventoryCapacity = capacity;
        this.inventory = inventory.map(id => new Item(getConsumableById(id)));
    }

    addItem(item: Item) {
        if (this.inventory.length >= this.inventoryCapacity) {
            console.error(`Cannot add ${item.name} to player ${this.num}'s inventory because it is full`);
            return;
        }
        this.inventory.push(item);
    }

    removeItem(item: Item) {
        console.log(`[ServerPlayer:removeItem] Removing ${item.name} from inventory`);
        const index = this.inventory.indexOf(item);
        if (index === -1) {
            console.error(`Cannot remove ${item.name} from player ${this.num}'s inventory because it is not there`);
            return;
        }
        this.inventory.splice(index, 1);
        if (!this.isAI) {
            this.team!.game.saveInventoryToDb(this.team!.getFirebaseToken(), this.dbId, this.inventory.map(item => item.id));
        }
    }

    getItemAtIndex(index: number): Item | null {
        if (index < 0 || index >= this.inventory.length) return null;
        return this.inventory[index];
    }

    setEquipment(equipment: Equipment) {
        this.equipment = equipment;
    }

    setSpells(slots: number, spellsIds: number[]) {
        this.spells = spellsIds.map(id => new Spell(getSpellById(id)));
        this.spell_slots = slots;
    }

    addSpell(spell: Spell) {
        this.spells.push(spell);
    }

    getSpellAtIndex(index: number): Spell | null {
        if (index < 0 || index >= this.spells.length) return null;
        return this.spells[index];
    }

    increaseDamageDealt(amount: number) {
        if (amount < 0) return; // = healing
        this.damageDealt += amount;
        // this.team?.increaseScoreFromDamage(amount);
    }

    // Called when traversing cells with terrain effects
    applyTerrainEffect(terrain: Terrain, potency = terrainDot[terrain]) {
        switch (terrain) {
            case Terrain.FIRE: {
                const damage = this.team?.isGame0() ? Math.round(potency / 2) : potency;
                this.takeDamage(damage);
                break;
            }
            default:
                break;
        }
    }

    // Called when the terrain effect is applied for the first time
    setUpTerrainEffect(terrain: Terrain) {
        // console.log(`[ServerPlayer:setUpTerrainEffect] Terrain effect ${terrain}`);

        if (DoTTerrains.includes(terrain)) {
            this.activeTerrainDoT = terrain;
        }

        if (terrain === Terrain.ICE) {
            this.addStatusEffect(StatusEffect.FREEZE, 3, 1);
        }
    }

    removeCurrentTerrainEffect() {
        this.removeTerrainEffect(this.activeTerrainDoT);
    }

    removeTerrainEffect(terrain: Terrain) {
        this.activeTerrainDoT = null;
        if (terrain === Terrain.ICE) {
            this.removeStatusEffect(StatusEffect.FREEZE);
        }
    }

    addStatusEffect(status: StatusEffect, duration: number, chance: number = 1, caster?: ServerPlayer) {
        if (this.isDead()) return false;
        const r = chance >= 1 ? 0 : Math.random();
        console.log(`[ServerPlayer:addStatusEffect] Adding status ${status} for ${duration} turns, ${chance}, r = ${r} / ${chance}`);
        if (r > chance) {
            // Shown over the target, so a failed roll is not mistaken for a spell without effect.
            this.team!.game.broadcast('statusresisted', {team: this.team!.id, num: this.num, status});
            return false;
        }

        // Refresh to the effect's limit, never add unlimited disabled activations.
        const cap = STATUS_TURNS[status] ?? 3;
        this.statuses[status] = Math.min(cap, Math.max(this.statuses[status], Math.min(cap, duration < 0 ? cap : duration)));
        if (DoTStatuses.includes(status)) this.statusDamage[status] = caster
            ? supportAmount(statusDot[status], caster.level, caster.getStat(Stat.SPATK)) : statusDot[status];

        this.broadcastStatusEffectChange();

        console.log(`[ServerPlayer:addStatusEffect] Incrementing team stats for status ${status}`);
        switch (status) {
            case StatusEffect.FREEZE:
                this.team!.incrementIce();
                break;
            case StatusEffect.MUTE:
                this.team!.incrementSilenced();
                break;
            case StatusEffect.PARALYZE:
                this.team!.incrementParalyzed();
                break;
            case StatusEffect.POISON:
                this.team!.incrementPoison();
                break;
        }
        return true;
    }

    removeStatusEffect(status: StatusEffect) {
        this.statuses[status] = 0;

        delete this.statusDamage[status];
        this.broadcastStatusEffectChange();
    }

    decrementStatuses() {
        let change = false;
        for (const status of this.activationStatuses) {
            if (this.statuses[status] > 0) {
                this.statuses[status]--;
                change = true;
                if (this.statuses[status] === 0) {
                    change = true;
                    this.removeStatusEffect(status as keyof StatusEffects);
                }
            }
        }
        if (change) this.broadcastStatusEffectChange();
    }

    clearStatusEffects() {
        let change = false;
        for (const status in this.statuses) {
            if (this.statuses[status] !== 0) change = true;
            this.statuses[status] = 0;
            this.removeStatusEffect(status as keyof StatusEffects);
        }
        if (change) this.broadcastStatusEffectChange();
    }

    gainXP(amount: number) {
        this.xp += amount;
        this.earnedXP += amount;
        while (this.xp >= getXPThreshold(this.level)) {
            this.levelUp();
        }
    }

    levelUp() {
        this.xp -= getXPThreshold(this.level);
        this.level++;
        this.levelsGained++;
        this.earnStatsPoints();
    }

    earnStatsPoints() {
        const reward = spBudget(this.level) - spBudget(this.level - 1);
        this.earnedStatsPoints += reward;
    }

    /** One action counts its targets, capped so area effects keep an edge without dominating. */
    recordAction(targetCount: number) {
        this.contribution += Math.min(Math.max(targetCount, 1), XP_CONTRIBUTION_TARGET_CAP);
    }

    addInteractedTarget(target: ServerPlayer) {
        this.interactedTargets.add(target);
    }

    countInteractedTargets() {
        return this.interactedTargets.size;
    }

    scaleStats(scale: number) {
        // Iterate over the keys of the stats object
        for (const stat in this.stats) {
            this.stats[stat] = Math.floor(this.stats[stat] * scale);
        }
        this.setHP(this.getStat(Stat.HP) * scale);
        this.setMP(this.getStat(Stat.MP) * scale);
    }

    setZombieInventory() {
        const inventory = setUpInventory(this.class, this.level, this.inventoryCapacity);
        this.inventory = inventory.map(id => new Item(getConsumableById(id)));
    }

    setZombieSpells() {
        const spells = getSpells(this.class, this.level, this.spell_slots, true);
        this.spells = spells.map(id => new Spell(getSpellById(id)));
        // console.log(`[ServerPlayer:setZombieSpells] Spells: ${this.spells.map(spell => spell.id).join(", ")}`);
    }

    zombieLevelUp(level: number) {
        // console.log(`[ServerPlayer:zombieLevelUp] Zombie level up for player ${this.num} to ${level}`);
        // console.log(`[ServerPlayer:zombieLevelUp] Stats before lvlUp: ${Object.values(this.stats).join(", ")}`);
        this.level = level;
        for (let i = 1; i < this.level; i++) {
            lvlUp(this.class, this.stats);
        }
        this.setHP(this.getStat(Stat.HP));
        this.setMP(this.getStat(Stat.MP));
        // console.log(`[ServerPlayer:zombieLevelUp] Stats after lvlUp: ${Object.values(this.stats).join(", ")}`);
    }
    isMage() {
        return this.class === Class.WHITE_MAGE || this.class === Class.BLACK_MAGE;
    }

    getWeapon() {
        return getEquipmentById(this.equipment.weapon);
    }

    hasSpells() {
        return this.spells.length > 0;
    }

    endTurn() {
        this.decrementStatuses();
        this.activationStatuses = [];
    }

    startTurn() {
        this.activationStatuses = Object.values(StatusEffect).filter(status => this.statuses[status] > 0);
        if (this.activeTerrainDoT) {
            this.applyTerrainEffect(this.activeTerrainDoT, this.team!.game.terrainManager.fireDamage.get(`${this.x},${this.y}`));

            this.team!.incrementFlames();
        }

        if (this.hasSpells()) {
            const cheapestSpell = this.spells.reduce((cheapest, spell) => spell.cost < cheapest.cost ? spell : cheapest, this.spells[0]);
            if (this.mp < cheapestSpell.cost) {
                this.team!.incrementLowMP();
            }
        }

        for (const status of DoTStatuses) {
            if (this.statuses[status] > 0) {
                this.takeDamage(this.statusDamage[status] ?? statusDot[status]);
            }
        }

        if (this.isDead()) return;

        if (this.isParalyzed()) {
            this.hasActed = true;
            this.team!.game.turnSystem.processAction(this, SpeedClass.SLOW);
            this.team!.game.combatClock.schedule(() => {
                this.team!.game.processTurn();
            }, PARALYZED_DELAY * 1000);
        }
    }

    setHasActed(hasActed: boolean) {
        this.hasActed = hasActed;
    }
}
