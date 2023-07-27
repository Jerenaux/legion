import { Socket, Server } from 'socket.io';
import { uuid } from 'uuidv4';

import { ServerPlayer } from './ServerPlayer';
import { Team } from './Team';

export abstract class Game
{
    id: string = uuid();
    teams: Map<number, Team> = new Map<number, Team>();
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();
    io: Server;
    sockets: Socket[] = [];
    tickTimer: NodeJS.Timeout | null = null;
    socketMap = new Map<Socket, Team>();

    constructor(io: Server, sockets: Socket[]) {
        this.io = io;
        this.sockets = sockets;

        this.sockets.forEach(socket => {
            socket.join(this.id);
        }, this);

        this.teams.set(1, new Team(1, this));
        this.teams.set(2, new Team(2, this));
        this.socketMap.set(sockets[0], this.teams.get(1)!);
        this.teams.get(1)?.setSocket(sockets[0]);
        
        this.populateTeams();
        this.populateGrid();
        this.sendGameStart();
    }

    abstract populateTeams(): void;

    isFree(gridX: number, gridY: number) {
        return !this.gridMap.get(`${gridX},${gridY}`);
    }

    freeCell(gridX: number, gridY: number) {
        this.gridMap.delete(`${gridX},${gridY}`);
    }

    occupyCell(gridX: number, gridY: number, player: ServerPlayer) {
        this.gridMap.set(`${gridX},${gridY}`, player);
    }

    populateGrid() {
        // Iterate over teams
        this.teams.forEach(team => {
            team.getMembers().forEach(player => {
                this.occupyCell(player.x, player.y, player);
            }, this);
        }, this);
    }

    sendGameStart() {
        // this.broadcast('gameStart', this.getPlacementData());
        this.sockets.forEach(socket => {
            const teamId = this.socketMap.get(socket)?.id!;
            socket.emit('gameStart', this.getPlacementData(teamId));
        });
    }

    broadcast(event: string, data: any) {
        this.io.in(this.id).emit(event, data);
    }

    getPlacementData(playerTeamId: number) {
        const otherTeamId = this.getOtherTeam(playerTeamId).id;
        const data = {
            'player': {
                'teamId': playerTeamId,
                'team': this.teams.get(playerTeamId)?.getMembers().map(player => player.getPlacementData(true))
            },
            'opponent': {
                'teamId': otherTeamId,
                'team': this.teams.get(otherTeamId)?.getMembers().map(player => player.getPlacementData())
            }
        }
        return data;
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

    getTeam(team: number): ServerPlayer[] {
        return this.teams.get(team)?.getMembers()!;
    }

    getOtherTeam(id: number): Team {
        return this.teams.get(id === 1 ? 2 : 1)!;
    }

    processAction(action: string, data: any, socket: Socket | null = null) {
        let team;
        if (socket) {
            team = this.socketMap.get(socket);
        } else {
            team = this.teams.get(2);
        }

        switch (action) {
            case 'move':
                this.processMove(data, team!);
                break;
            case 'attack':
                this.processAttack(data, team!);
                break;
        }
    }

    processMove({tile, num}: {tile: Tile, num: number}, team: Team) {
        const player = team.getMembers()[num - 1];
        if (!this.isValidCell(player.x, player.y, tile.x, tile.y)) return;
        if (!player.canAct || !player.isAlive() || !player.canMoveTo(tile.x, tile.y)) return;
        
        this.freeCell(player.x, player.y);
        player.updatePos(tile.x, tile.y);
        this.occupyCell(player.x, player.y, player);

        const cooldown = player.cooldowns.move;
        player.setCooldown(cooldown);
        
        this.broadcast('move', {
            team: team.id,
            tile,
            num,
        });

        team.socket?.emit('cooldown', {
            num,
            cooldown,
        });
    }

    processAttack({num, target}: {num: number, target: number}, team: Team) {
        const player = team.getMembers()[num - 1];
        const opponentTeam = this.getOtherTeam(team.id);
        const opponent = opponentTeam.getMembers()[num - 1];
        
        if (!player.canAct || !player.isNextTo(opponent.x, opponent.y) || !player.isAlive() || !opponent.isAlive()) return;
        
        const damage = this.calculateDamage(player, opponent);
        opponent.dealDamage(damage);
        
        const cooldown = player.cooldowns.attack;
        player.setCooldown(cooldown);

        this.broadcast('attack', {
            team: team.id,
            target,
            num,
            damage,
            hp: opponent.getHP(),
        });

        team.socket?.emit('cooldown', {
            num,
            cooldown,
        });
    }

    AItick() {
        // (this.teams.get(2)?.getMembers() as AIServerPlayer[]).forEach(opponent => {
        //     opponent.takeAction();
        // });
    }

    listAdjacentEnemies(player: ServerPlayer): ServerPlayer[] {
        const adjacentEnemies: ServerPlayer[] = [];
        const oppositeTeamId = player.team!.id === 1 ? 2 : 1;
        const oppositeTeam = this.teams.get(oppositeTeamId)!;
        oppositeTeam.getMembers().forEach(enemy => {
            if (player.isNextTo(enemy.x, enemy.y)) {
                adjacentEnemies.push(enemy);
            }
        });
        return adjacentEnemies;
    }

    listAllEnemies(player: ServerPlayer): ServerPlayer[] {
        const oppositeTeamId = player.team!.id === 1 ? 2 : 1;
        const oppositeTeam = this.teams.get(oppositeTeamId)!;
        return  oppositeTeam.getMembers();
    }

    specialRound(num: number) {
        if (num >= 0) {
            return Math.round(num);
        } else {
            return -Math.round(-num);
        }
    }

    lineOfSight(startX: number, startY: number, endX: number, endY: number) {
        // Get the distance between the start and end points
        let distance = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
    
        // Calculate the number of steps to check, based on the distance
        let steps = Math.ceil(distance);
    
        // console.log(`Line of sight from (${startX}, ${startY}) to (${endX}, ${endY})`);
        for (let i = 1; i < steps; i++) {
            // Calculate the current position along the line
            const xInc = this.specialRound(i / steps * (endX - startX));
            const yInc = this.specialRound(i / steps * (endY - startY));
            let currentX = Math.round(startX + xInc);
            let currentY = Math.round(startY + yInc);
            if (currentX == startX && currentY == startY) continue;

            // Check if this position is occupied
            if (!this.isFree(currentX, currentY)) {
                // console.log(`Line of sight blocked at (${currentX}, ${currentY})`);
                // If the position is occupied, return false
                return false;
            }
        }
    
        // If no occupied positions were found, return true
        return true;
    }

    isSkip(x: number, y: number) {
        const gridWidth = 20;
        const gridHeight = 9;
        if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return true;
        const v = 3;
        const skip = y < gridHeight/2 ? Math.max(0, v - y - 1) : Math.max(0, y - (gridHeight - v));
        // Skip drawing the corners to create an oval shape
        return (x < skip || x >= gridWidth - skip);
    }

    isValidCell(fromX: number, fromY: number, toX: number, toY: number) {
        return !this.isSkip(toX, toY)
        && this.isFree(toX, toY)
        && this.lineOfSight(fromX, fromY, toX, toY)
    }

    listCellsInRange(gridX: number, gridY: number, radius: number): Tile[] {
        const tiles: Tile[] = [];
        for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
                // Check if the cell is within the circle
                if (x * x + y * y <= radius * radius) {
                    if(!this.isValidCell(gridX, gridY, gridX + x, gridY + y)) continue;
                    tiles.push({
                        x: gridX + x,
                        y: gridY + y,
                    });
                }
            }
        }
        return tiles;
    }
}

interface Tile {
    x: number;
    y: number;
}