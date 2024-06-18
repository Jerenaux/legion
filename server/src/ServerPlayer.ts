import { Team } from './Team';
import { Item } from './Item';
import { Spell } from './Spell';
import { Stat, Terrain, StatusEffect, Class } from "@legion/shared/enums";
import { getConsumableById } from '@legion/shared/Items';
import { getSpellById } from '@legion/shared/Spells';
import { getXPThreshold } from '@legion/shared/levelling';
import { PlayerNetworkData, StatusEffects } from '@legion/shared/interfaces';
import {TIME_COEFFICIENT} from "@legion/shared/config";


const terrainDot = {
    [Terrain.FIRE]: 10,
}

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
    hp;
    maxHP;
    mp;
    maxMP;
    distance;
    atk;
    def;
    spatk;
    spdef;
    cooldowns;
    cooldown: number = 0;
    cooldownTimer: NodeJS.Timeout | null = null;
    DoTTimer: NodeJS.Timeout | null = null;
    statusesTimer: NodeJS.Timeout | null = null;
    inventoryCapacity: number = 3;
    inventory: Item[] = [];
    spells: Spell[] = [];
    isCasting: boolean = false;
    damageDealt: number = 0;
    entranceTime: number = 2.5;
    statuses: StatusEffects;
    interactedTargets: Set<ServerPlayer> = new Set();
    class: Class;
    isAI = false;

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
        };
        
        this.cooldowns = {
            'move': 400,
            'attack': 800
        };
        this.setCooldown(this.cooldowns.move + this.entranceTime * 1000, false);
        this.setStatusesTimer();
    }

    getPlacementData(includePersonal = false): PlayerNetworkData {
        const data: PlayerNetworkData = {
            name: this.name,
            frame: this.frame,
            x: this.x,
            y: this.y,
            hp: this.hp,
            maxHP: this.maxHP,
            statuses: this.statuses,
            class: this.class,
            level: this.level,
        }
        if (includePersonal) {
            data['mp'] = this.mp;
            data['maxMP'] = this.maxMP;
            data['distance'] = this.distance;
            data['cooldown'] = this.cooldown;
            data['inventory'] = this.getNetworkInventory();
            data['spells'] = this.getNetworkSpells();
            data['xp'] = this.xp;
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
        return this.statuses[StatusEffect.FREEZE] > 0;
    }

    isParalyzed() {
        return (this.statuses[StatusEffect.PARALYZE] > 0) || this.isFrozen();
    }

    canAct() {
        return this.cooldown == 0 && this.isAlive() && !this.isCasting && !this.isParalyzed();
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

    updatePos(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    distanceTo(x: number, y: number) {
        return Math.sqrt(Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2));
    }

    takeDamage(damage: number) {
        this.updateHP(damage);
        this.team!.game.checkFirstBlood(this.team);
    }

    heal(amount: number) {
        this.updateHP(-amount);
    }

    updateHP(amount: number) {
        this._hp = this.hp;
        this.hp -= Math.round(amount);
        this.hp = Math.max(Math.min(this.hp, this.maxHP), 0);

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

    getHPratio() {
        return this.hp / this.maxHP;
    }

    getPreviousHPRatio() {
        return this._hp / this.maxHP;
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
        if (this.mp > this.maxMP) {
            this.mp = this.maxMP;
        }
        return this.mp;
    }
    
    setLevel(level: number) {
        this.level = level;
    }

    setHP(hp: number) {
        this.maxHP = hp;
        this.hp = this.maxHP;
        this._hp = this.maxHP;
    }

    getHP() {
        return this.hp;
    } 

    getLevel() {
        return this.level;
    }

    setMP(mp: number) {
        this.maxMP = mp;
        this.mp = this.maxMP;
    }

    getMP() {
        return this.mp;
    }

    getStatValue(data, stat) {
        return data.stats[stat] + data.equipment_bonuses[stat] + data.sp_bonuses[stat];
    }

    setUpCharacter(data, isAI = false) {
        this.setHP(this.getStatValue(data, "hp"));
        this.setMP(this.getStatValue(data, "mp"));
        this.setStat(Stat.ATK, this.getStatValue(data, "atk"));
        this.setStat(Stat.DEF, this.getStatValue(data, "def"));
        this.setStat(Stat.SPATK, this.getStatValue(data, "spatk"));
        this.setStat(Stat.SPDEF, this.getStatValue(data, "spdef"));
        this.setInventory(data.carrying_capacity, data.inventory);
        this.setSpells(data.skill_slots, data.skills);
        this.level = data.level;
        this.xp = data.xp;
        this.class = data.class;
        this.dbId = data.id;
        this.isAI = isAI;
    }

    setStat(stat: Stat, value: number) {
        switch (stat) {
            case Stat.SPATK:
                this.spatk = value;
                break;
            case Stat.SPDEF:
                this.spdef = value;
                break;
            case Stat.ATK:
                this.atk = value;
                break;
            case Stat.DEF:
                this.def = value;
                break;
            default:
                throw new Error(`Invalid stat ${stat}`);
        }
    }

    getStat(stat: Stat) {
        switch (stat) {
            case Stat.SPATK:
                return this.spatk;
            case Stat.SPDEF:
                return this.spdef;
            case Stat.ATK:
                return this.atk;
            case Stat.DEF:
                return this.def;
            case Stat.NONE:
                return 0;
            default:
                throw new Error(`Invalid stat ${stat}`);
        }
    }

    getCooldown(action: ActionType): number {
        return this.cooldowns[action];
    }
    
    setCooldown(duration: number, applyCoefficient = true) {
        this.cooldown = duration;
        if (applyCoefficient) {
            this.cooldown *= TIME_COEFFICIENT;
        }
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        this.cooldownTimer = setTimeout(() => {
            this.cooldown = 0;
        }, this.cooldown);
    }

    setStatusesTimer() {
        this.statusesTimer = setInterval(() => {
            this.decrementStatuses();
        }, 1000);
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

    setSpells(slots: number, spellsIds: number[]) {
        this.spells = spellsIds.map(id => new Spell(getSpellById(id)));
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
                this.takeDamage(terrainDot[terrain]);
                break;
            default:
                break;
        }
    }

    applyDoT(damage: number) {
        this.takeDamage(damage);
        this.team!.game.getOtherTeam(this.team.id).increaseScoreFromDot();
    }

    // Called when the terrain effect is applied for the first time
    setUpTerrainEffect(terrain: Terrain) {
        switch (terrain) {
            case Terrain.FIRE:
                if (this.DoTTimer) {
                    clearTimeout(this.DoTTimer);
                }
                this.DoTTimer = setInterval(() => {
                    this.applyDoT(terrainDot[terrain]);
                }, 3000);
                break;
            case Terrain.ICE:
                this.addStatusEffect(StatusEffect.FREEZE, -1, 1);
                break;
            case Terrain.NONE:
                if (this.isFrozen()) {
                    this.removeStatusEffect(StatusEffect.FREEZE);
                }
                break;
            default:
                break;
        }
        
    }

    addStatusEffect(status: StatusEffect, duration: number, chance: number = 1) {
        if (Math.random() > chance) return false;
        switch(status) {
            case StatusEffect.PARALYZE:
                this.statuses[StatusEffect.PARALYZE] = duration;
                break;
            case StatusEffect.FREEZE:
                this.statuses[StatusEffect.FREEZE] = duration;
                break;
            default:
                break;
        }
        this.broadcastStatusEffectChange();
        return true;
    }

    removeStatusEffect(status: StatusEffect) {
        switch(status) {
            case StatusEffect.PARALYZE:
                this.statuses[StatusEffect.PARALYZE] = 0;
                break;
            case StatusEffect.FREEZE:
                this.statuses[StatusEffect.FREEZE] = 0;
                break;
            default:
                break;
        }
        this.broadcastStatusEffectChange();
    }

    decrementStatuses() {
        let change = false;
        for (const key in this.statuses) {
            if (this.statuses[key] > 0) {
                this.statuses[key]--;
                change = true;
            }
        }
        if (change) this.broadcastStatusEffectChange();
    }

    stopDoT() {
        if (this.DoTTimer) {
            clearTimeout(this.DoTTimer);
        }
    }

    gainXP(amount: number) {
        // console.log(`Player ${this.num} gained ${amount} XP`)
        this.xp += amount;
        this.earnedXP += amount;
        // console.log(`${this.xp} / ${getXPThreshold(this.level)}`)
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

    clearAllTimers() {
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        if (this.DoTTimer) {
            clearInterval(this.DoTTimer);
        }
        if (this.statusesTimer) {
            clearInterval(this.statusesTimer);
        }
    }

    addInteractedTarget(target: ServerPlayer) {
        this.interactedTargets.add(target);
    }

    countInteractedTargets() {
        return this.interactedTargets.size;
    }
}

