import { Socket, Server } from 'socket.io';
import { uuid } from 'uuidv4';

import { ServerPlayer } from './ServerPlayer';

export class Game
{
    id: string = uuid();
    players: ServerPlayer[] = [];
    opponents: ServerPlayer[] = [];
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();
    io: Server;
    sockets: Socket[] = [];

    constructor(io: Server, sockets: Socket[]) {
        this.io = io;
        this.sockets = sockets;
        this.players.push(new ServerPlayer('warrior_1', 5, 4));
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

        this.sockets.forEach(socket => {
            socket.join(this.id);
        }, this);

        this.broadcast('gameStart', this.getPlacementData());
    }

    broadcast(event: string, data: any) {
        this.io.in(this.id).emit(event, data);
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

    isFree(gridX: number, gridY: number) {
        const isFree = !this.gridMap.get(`${gridX},${gridY}`);
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

    processMove({tile, num}: {tile: Tile, num: number}) {
        if (!this.isFree(tile.x, tile.y)) return;
        const player = this.players[num - 1];
        if (!player.canAct || !player.isAlive() || !player.canMoveTo(tile.x, tile.y)) return;
        player.updatePos(tile.x, tile.y);
        const cooldown = player.cooldowns.move;
        player.setCooldown(cooldown);
        this.broadcast('move', {
            isPlayer: true,
            tile,
            num,
            cooldown, // TODO: send separately
        });
    }

    processAttack({num, target}: {num: number, target: number}) {
        const player = this.players[num - 1];
        const opponent = this.opponents[target - 1];
        if (!player.canAct || !player.isNextTo(opponent.x, opponent.y) || !player.isAlive() || !opponent.isAlive()) return;
        const damage = this.calculateDamage(player, opponent);
        opponent.dealDamage(damage);
        const cooldown = player.cooldowns.attack;
        player.setCooldown(cooldown);
        this.broadcast('attack', {
            isPlayer: true,
            target,
            num,
            damage,
            hp: opponent.getHP(),
            cooldown, // TODO: send separately
        });
    }
}

interface Tile {
    x: number;
    y: number;
}