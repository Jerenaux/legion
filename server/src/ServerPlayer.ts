import { Team } from './Team';
import { Item } from './Item';
import { Spell } from './Spell';
import { Stat, Terrain, StatusEffect, Class, SpeedClass } from "@legion/shared/enums";
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { getMaxStatValue, getXPThreshold } from '@legion/shared/levelling';
import { CharacterStats, Equipment, PlayerNetworkData, StatusEffects } from '@legion/shared/interfaces';
import { INJURED_MODE, PARALYZED_DELAY } from "@legion/shared/config";
import { getEquipmentById } from '@legion/shared/Equipments';
import { getSpells, lvlUp, setUpInventory } from '@legion/shared/NewCharacter';


const terrainDot = {
    [Terrain.FIRE]: 20,
}

const statusDot = {
    [StatusEffect.POISON]: 10,
    [StatusEffect.BURN]: 20,
}

const statsModifyingStatuses = {
    [StatusEffect.HASTE]: {
        [Stat.SPEED]: 1.5,
    },
};

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
    activeTerrainDoT: Terrain | null = null;
    class: Class;
    isAI = false;
    hasActed: boolean = false;

    constructor(num: number, name: string, frame: string, x: number, y: number) {
        this.num = num;
        this.name = name;
        this.frame = frame;
        this.x = x;
        this.y = y;
        this.distance = 3;

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
            frame: this.frame,
            x: this.x,
            y: this.y,
            hp: this.hp,
            maxHP: this.getStat(Stat.HP),
            statuses: this.statuses,
            class: this.class,
            level: this.level,
        }
        if (includePersonal) {
            data['mp'] = this.mp;
            data['maxMP'] = this.getStat(Stat.MP);
            data['distance'] = this.distance;
            data['inventory'] = this.getNetworkInventory();
            data['spells'] = this.getNetworkSpells();
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
        return this.statuses[StatusEffect.FREEZE] != 0;
    }

    isParalyzed() {
        return (this.statuses[StatusEffect.PARALYZE] != 0) || this.isFrozen();
    }

    isHasted() {
        return this.statuses[StatusEffect.HASTE] != 0;
    }

    isMuted() {
        return this.statuses[StatusEffect.MUTE] != 0;
    }

    canAct() {
        return this.isAlive() && !this.isParalyzed();
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2) <= Math.pow(this.distance, 2);
    }

    isNextTo(x: number, y: number) {
        return (Math.abs(x - this.x) <= 1 && Math.abs(y - this.y) <= 1);
    }

    isInArea(x: number, y: number, radius: number) {
        // Radius is the not-divided-by-2 size of the spell/item
        const leftOffset = radius % 2 === 0 ? (radius / 2) - 1 : Math.floor(radius / 2);
        const rightOffset = Math.floor(radius / 2);
        return this.x >= x - leftOffset && this.x <= x + rightOffset && this.y >= y - leftOffset && this.y <= y + rightOffset;
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

        this.updateHP(damage);
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
        this.hp = Math.max(Math.min(this.hp, this.getStat(Stat.HP)), 0);

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
        return this.getStat(Stat.HP);
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
        this.mp -= amount;
        if (this.mp < 0) {
            this.mp = 0;
        }
        return this.mp;
    }

    restoreMP(amount: number) {
        this._mp = this.mp;
        this.mp += amount;
        if (this.mp > this.getMaxMP()) {
            this.mp = this.getMaxMP();
        }
        return this.mp;
    }

    hasStatusEffect(status: StatusEffect) {
        return this.statuses[status] != 0;
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
        this.hp = INJURED_MODE ? this.getMaxHP() / 2 : this.getMaxHP();
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

    setUpCharacter(data, isAI = false) {
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
        this.setSpells(data.skill_slots, data.skills);
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
        return Math.min(this.stats[stat] * this.stats_modifiers[stat], getMaxStatValue(stat)) || 0;
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
    applyTerrainEffect(terrain: Terrain) {
        switch (terrain) {
            case Terrain.FIRE:
                const damage = this.team?.isGame0() ? terrainDot[terrain] / 2 : terrainDot[terrain];
                this.takeDamage(damage);
                break;
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

        if (terrain == Terrain.ICE) {
            this.addStatusEffect(StatusEffect.FREEZE, -1, 1);
        }
    }

    removeCurrentTerrainEffect() {
        this.removeTerrainEffect(this.activeTerrainDoT);
    }

    removeTerrainEffect(terrain: Terrain) {
        this.activeTerrainDoT = null;
        if (terrain == Terrain.ICE) {
            this.removeStatusEffect(StatusEffect.FREEZE);
        }
    }

    addStatusEffect(status: StatusEffect, duration: number, chance: number = 1) {
        if (this.isDead()) return false;
        const r = Math.random();
        console.log(`[ServerPlayer:addStatusEffect] Adding status ${status} for ${duration} turns, ${chance}, r = ${r} / ${chance}`);
        if (r > chance) return false;

        this.statuses[status] = duration;

        if (statsModifyingStatuses[status]) {
            for (const stat in statsModifyingStatuses[status]) {
                this.setStatsModifier(stat as unknown as Stat, statsModifyingStatuses[status][stat]);
            }
        }

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

        if (statsModifyingStatuses[status]) {
            for (const stat in statsModifyingStatuses[status]) {
                this.setStatsModifier(stat as unknown as Stat, 1);
            }
        }

        this.broadcastStatusEffectChange();
    }

    decrementStatuses() {
        let change = false;
        for (const status in this.statuses) {
            if (this.statuses[status] > 0) {
                this.statuses[status]--;
                if (this.statuses[status] == 0) {
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
            if (this.statuses[status] != 0) change = true;
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
        // Earn 3 + floor(level/10) points + a small chance of 1 extra point
        const reward = (3 + Math.floor(this.level / 10) + (Math.random() < 0.1 ? 1 : 0));
        this.earnedStatsPoints += reward;
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

    startTurn() {
        if (this.activeTerrainDoT) {
            this.applyTerrainEffect(this.activeTerrainDoT);  
            
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
                this.takeDamage(statusDot[status]);
            }
        }

        this.decrementStatuses();

        if (this.isParalyzed()) {
            this.team!.game.turnSystem.processAction(this, SpeedClass.SLOW);
            setTimeout(() => {
                this.team!.game.processTurn();
            }, PARALYZED_DELAY * 1000);
        }
    }

    setHasActed(hasActed: boolean) {
        this.hasActed = hasActed;
    }
}

