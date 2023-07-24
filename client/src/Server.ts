class ServerPlayer {
    frame;
    x;
    y;
    hp;
    maxHP;
    distance;
    atk;
    def;
    cooldowns;
    cooldown;
    cooldownTimer;
    canAct = false;

    constructor(frame, x, y) {
        this.frame = frame;
        this.x = x;
        this.y = y;
        this.maxHP = 100;
        this.hp = this.maxHP;
        this.distance = 3;
        this.atk = 10;
        this.def = 10;
        this.cooldowns = {
            'move': 5000,
            'attack': 5000
        };
        this.cooldown = 5000;
        this.setCooldown(this.cooldown);
//         Every level up, a character gains:
//         Attack: +2 and +10% of current attack
//         Defense: +3 and +8% of current defense

// Written as formulas, these might be:

//     New Attack = Current Attack + 2 + Current Attack * 0.10
//     New Defense = Current Defense + 3 + Current Defense * 0.08
    }

    getPlacementData(includePersonal = false) {
        return {
            'frame': this.frame,
            'x': this.x,
            'y': this.y,
            'distance': includePersonal ? this.distance : 0,
            'hp': this.maxHP,
            'cooldown': includePersonal ? this.cooldown : 0
        }
    }

    canMoveTo(x: number, y: number) {
        // Check if (x, y) is within a circle of radius `this.distance` from (this.gridX, this.gridY)
        return Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2) <= Math.pow(this.distance, 2);
    }

    isNextTo(x: number, y: number) {
        return (Math.abs(x - this.x) <= 1 && Math.abs(y - this.y) <= 1);
    }

    isAlive() {
        return this.hp > 0;
    }

    updatePos(x, y) {
        this.x = x;
        this.y = y;
    }

    dealDamage(damage) {
        this.hp -= damage;
        if (this.hp < 0) {
            this.hp = 0;
        }
    }

    getHP() {
        return this.hp;
    } 
    
    setCooldown(duration) {
        this.canAct = false;
        if (this.cooldownTimer) {
            clearTimeout(this.cooldownTimer);
        }
        this.cooldownTimer = setTimeout(() => {
            this.canAct = true;
        });
    }
}

export class Server
{
    players: ServerPlayer[] = [];
    opponents: ServerPlayer[] = [];
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();

    constructor() {
        this.players.push(new ServerPlayer('warrior_1', 4, 4));
        this.players.push(new ServerPlayer('mage_1', 18, 2));
        this.players.push(new ServerPlayer('warrior_2', 18, 6));
        this.opponents.push(new ServerPlayer('warrior_3', 3, 4));
        this.opponents.push(new ServerPlayer('mage_2', 1, 2));
        this.opponents.push(new ServerPlayer('warrior_4', 1, 6));

        this.players.forEach(player => {
            this.gridMap.set(`${player.x},${player.y}`, player);
        });
        this.opponents.forEach(player => {
            this.gridMap.set(`${player.x},${player.y}`, player);
        });
    }

    getPlacementData() {
        const data = {
            'player': {
                'team': this.players.map(player => player.getPlacementData(true))
            },
            'opponent': {
                'team': this.opponents.map(player => player.getPlacementData())
            }
        }
        return data;
    }

    isFree(gridX, gridY) {
        const isFree = !this.gridMap[`${gridX},${gridY}`];
        return isFree;
    }

    calculateDamage(attacker: ServerPlayer, defender: ServerPlayer) {
        // Calculate the base damage
        // let baseDamage = attacker.atk - defender.def;
        let baseDamage = attacker.atk / (1 + defender.def);
        baseDamage *= 10;
    
        // Ensure baseDamage doesn't fall below some minimum (e.g., 1)
        baseDamage = Math.max(baseDamage, 1);
    
        // Add randomness factor - in this case, damage can be from 0.9 to 1.1 times the baseDamage
        let randomFactor = 0.9 + Math.random() * 0.2;
        let totalDamage = baseDamage * randomFactor;
    
        // Round the result to get rid of fractions
        totalDamage = Math.round(totalDamage);
    
        // Ensure totalDamage is at least 1
        totalDamage = Math.max(totalDamage, 1);
    
        return totalDamage;
    }

    processMove({tile, num}) {
        if (!this.isFree(tile.x, tile.y)) return;
        const player = this.players[num - 1];
        if (!player.canAct || !player.isAlive() || !player.canMoveTo(tile.x, tile.y)) return;
        player.updatePos(tile.x, tile.y);
        const cooldown = player.cooldowns.move;
        player.setCooldown(cooldown);
        return {
            isPlayer: true,
            tile,
            num,
            cooldown, // TODO: send separately
        };
    }

    processAttack({num, target}) {
        const player = this.players[num - 1];
        const opponent = this.opponents[target - 1];
        if (!player.canAct || !player.isNextTo(opponent.x, opponent.y) || !player.isAlive() || !opponent.isAlive()) return;
        const damage = this.calculateDamage(player, opponent);
        opponent.dealDamage(damage);
        const cooldown = player.cooldowns.attack;
        player.setCooldown(cooldown);
        return {
            isPlayer: true,
            target,
            num,
            damage,
            hp: opponent.getHP(),
            cooldown, // TODO: send separately
        };
    }
}