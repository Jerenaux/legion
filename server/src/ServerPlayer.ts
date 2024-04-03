import { Team } from './Team';
import { Item } from './Item';
import { Spell } from './Spell';
import { Stat, Terrain } from "@legion/shared/enums";
import { items } from '@legion/shared/Items';
import { spells } from '@legion/shared/Spells';
import { getXPThreshold } from '@legion/shared/levelling';

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
    inventoryCapacity: number = 3;
    inventory: Item[] = [];
    spells: Spell[] = [];
    isCasting: boolean = false;
    damageDealt: number = 0;
    entranceTime: number = 2.5;

    constructor(num: number, name: string, frame: string, x: number, y: number) {
        this.num = num;
        this.name = name;
        this.frame = frame;
        this.x = x;
        this.y = y;
        this.distance = 3;
        
        this.cooldowns = {
            'move': 2000,
            'attack': 4000
        };
        // this.setCooldown(0 + this.entranceTime * 1000);
        this.setCooldown(this.cooldowns.move + this.entranceTime * 1000);
    }

    getPlacementData(includePersonal = false): playerNetworkData {
        const data: playerNetworkData = {
            'name': this.name,
            'frame': this.frame,
            'x': this.x,
            'y': this.y,
            'hp': this.maxHP,
        }
        if (includePersonal) {
            data['mp'] = this.maxMP;
            data['distance'] = this.distance;
            data['cooldown'] = this.cooldown;
            data['inventory'] = this.getNetworkInventory();
            data['spells'] = this.getNetworkSpells();
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

    canAct() {
        return this.cooldown == 0 && this.isAlive() && !this.isCasting;
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2) <= Math.pow(this.distance, 2);
    }

    isNextTo(x: number, y: number) {
        return (Math.abs(x - this.x) <= 1 && Math.abs(y - this.y) <= 1);
    }

    isInArea(x: number, y: number, radius: number) {
        return this.x >= x - radius && this.x <= x + radius && this.y >= y - radius && this.y <= y + radius;
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

        if (this.hp <= 0) {
            this.team!.game.checkEndGame();
        }
    }

    broadcastHPChange() {
        this.team!.game.broadcastHPchange(this.team, this.num, this.hp, this.getHPDelta());
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

    setMP(mp: number) {
        this.maxMP = mp;
        this.mp = this.maxMP;
    }

    getMP() {
        return this.mp;
    }

    setUpCharacter(data) {
        this.setHP(data.stats.hp);
        this.setMP(data.stats.mp);
        this.setStat(Stat.ATK, data.stats.atk);
        this.setStat(Stat.DEF, data.stats.def);
        this.setStat(Stat.SPATK, data.stats.spatk);
        this.setStat(Stat.SPDEF, data.stats.spdef);
        this.setInventory(data.carrying_capacity, data.inventory);
        this.setSpells(data.skill_slots, data.skills);
        this.level = data.level;
        this.xp = data.xp;
        this.dbId = data.id;
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
    
    setCooldown(duration: number) {
        this.cooldown = duration;
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        this.cooldownTimer = setTimeout(() => {
            this.cooldown = 0;
        }, duration);
    }

    setTeam(team: Team) {
        this.team = team;
    }

    setInventory(capacity: number, inventory: number[]) {
        this.inventoryCapacity = capacity;
        this.inventory = inventory.map(id => new Item(items[id]));
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
        this.team!.game.saveInventoryToDb(this.team!.getFirebaseToken(), this.dbId, this.inventory.map(item => item.id));
    }

    getItemAtIndex(index: number): Item | null {
        if (index < 0 || index >= this.inventory.length) return null;
        return this.inventory[index];
    }

    setSpells(slots: number, spellsIds: number[]) {
        this.spells = spellsIds.map(id => new Spell(spells[id]));
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
        this.team?.increaseScoreFromDamage(amount);
    }


    applyTerrainEffect(terrain: Terrain) {
        switch (terrain) {
            case Terrain.FIRE:
                console.log(`Player ${this.num} is standing on fire!`);
                this.takeDamage(10);
                break;
            default:
                break;
        }
    }

    setUpDoT(terrain: Terrain) {
        console.log(`Setting up DoT for player ${this.num}`);
        if (this.DoTTimer) {
            clearTimeout(this.DoTTimer);
        }
        this.DoTTimer = setInterval(() => {
            this.applyTerrainEffect(terrain);
        }, 3000);
    }

    stopDoT() {
        if (this.DoTTimer) {
            clearTimeout(this.DoTTimer);
        }
    }

    gainXP(amount: number) {
        console.log(`Player ${this.num} gained ${amount} XP`)
        this.xp += amount;
        console.log(`${this.xp} / ${getXPThreshold(this.level)}`)
        while (this.xp >= getXPThreshold(this.level)) {
            this.levelUp();
        }
    }

    levelUp() {
        this.xp -= getXPThreshold(this.level);
        this.level++;
        this.earnStatsPoints();
    }

    earnStatsPoints() {
        // Earn 3 + floor(level/10) points + a small chance of 1 extra point
        const reward = (3 + Math.floor(this.level / 10) + (Math.random() < 0.1 ? 1 : 0));
        console.log(`Player ${this.num} earned ${reward} stats points`);
        this.earnedStatsPoints += reward;
    }

    clearAllTimers() {
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        if (this.DoTTimer) {
            clearTimeout(this.DoTTimer);
        }
    }
}

interface playerNetworkData {
    frame: string;
    name: string;
    x: number;
    y: number;
    hp: number;
    mp?: number;
    distance?: number;
    cooldown?: number;
    inventory?: number[];
    spells?: number[];
}