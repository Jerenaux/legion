import { Team } from './Team';
import { Item, NetworkItem, Stat } from './Item';
import { Spell, NetworkSpell } from './Spell';

export type ActionType = 'move' | 'attack';
export class ServerPlayer {
    num;
    frame;
    x;
    y;
    team: Team | null = null;
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
    inventory: Map<Item, number> = new Map<Item, number>();
    spells: Spell[] = [];
    isCasting: boolean = false;
    damageDealt: number = 0;
    entranceTime: number = 2.5;

    constructor(num: number, frame: string, x: number, y: number) {
        this.num = num;
        this.frame = frame;
        this.x = x;
        this.y = y;
        this.maxHP = 100;
        this.hp = this.maxHP;
        this.maxMP = 20;
        this.mp = this.maxMP;
        this.distance = 3;
        // Random number between 8 and 12
        this.atk = Math.floor(Math.random() * 5) + 8;
        this.def = Math.floor(Math.random() * 5) + 8;
        this.spatk = Math.floor(Math.random() * 5) + 8;
        this.spdef = Math.floor(Math.random() * 5) + 8;
        this.cooldowns = {
            'move': 2000,
            'attack': 4000
        };
        this.setCooldown(this.cooldowns.move + this.entranceTime * 1000);

//         Every level up, a character gains:
//         Attack: +2 and +10% of current attack
//         Defense: +3 and +8% of current defense

// Written as formulas, these might be:

//     New Attack = Current Attack + 2 + Current Attack * 0.10
//     New Defense = Current Defense + 3 + Current Defense * 0.08
    }

    getPlacementData(includePersonal = false): playerNetworkData {
        const data: playerNetworkData = {
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

    getNetworkInventory(): NetworkInventory[] {
        // Map every item to its network data
        return [...this.inventory.entries()].map(([item, quantity]) => {
            return {
                'item': item.getNetworkData(),
                'quantity': quantity
            }
        });
    }

    getNetworkSpells() {
        return this.spells.map(spell => spell.getNetworkData());
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
        this._hp = this.hp;
        this.hp -= Math.round(damage);
        if (this.hp < 0) {
            this.hp = 0;
        }

        this.team?.game.checkEndGame();
    }

    getHPDelta() {
        return this.hp - this._hp;
    }

    heal(amount: number) {
        this._hp = this.hp;
        this.hp += amount;
        if (this.hp > this.maxHP) {
            this.hp = this.maxHP;
        }
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

    getHP() {
        return this.hp;
    } 

    getMP() {
        return this.mp;
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

    addItem(item: Item, quantity: number) {
        const currentQuantity = this.inventory.get(item) || 0;
        this.inventory.set(item, currentQuantity + quantity);
    }

    removeItem(item: Item, quantity: number) {
        const currentQuantity = this.inventory.get(item) || 0;
        if (currentQuantity < quantity) {
            throw new Error(`Cannot remove ${quantity} ${item.name} from player ${this.num} because they only have ${currentQuantity}`);
        }
        this.inventory.set(item, currentQuantity - quantity);
        return this.inventory.get(item);
    }

    getItemQuantity(item: Item): number {
        return this.inventory.get(item) || 0;
    }

    getItemAtIndex(index: number): Item | null {
        const items = [...this.inventory.keys()];
        if (index < 0 || index >= items.length) {
            return null;
        }
        return items[index];
    }

    addSpell(spell: Spell) {
        this.spells.push(spell);
    }

    increaseDamageDealt(amount: number) {
        this.damageDealt += amount;
    }
}

interface playerNetworkData {
    frame: string;
    x: number;
    y: number;
    hp: number;
    mp?: number;
    distance?: number;
    cooldown?: number;
    inventory?: NetworkInventory[];
    spells?: NetworkSpell[];
}

interface NetworkInventory {
    item: NetworkItem;
    quantity: number;
}