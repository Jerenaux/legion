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
    gameOver: boolean = false;
    cooldownCoef: number = 1;

    gridWidth: number = 20;
    gridHeight: number = 10;

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

    getPlayersInArea(x: number, y: number, radius: number) {
        const players: ServerPlayer[] = [];
        this.teams.forEach(team => {
            team.getMembers().forEach(player => {
                if (player.isAlive() && player.isInArea(x, y, radius)) {
                    players.push(player);
                }
            });
        });
        return players;
    }

    processAction(action: string, data: any, socket: Socket | null = null) {
        if (this.gameOver) return;

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
            case 'useitem':
                this.processUseItem(data, team!);
                break;
            case 'skill':
                this.processSkill(data, team!);
                break;
        }
    }

    checkEndGame() {
        const team1 = this.teams.get(1)!;
        const team2 = this.teams.get(2)!;
        if (team1.isDefeated() || team2.isDefeated()) {
            this.broadcast('gameEnd', {
                winner: team1.isDefeated() ? 2 : 1,
            });
            this.gameOver = true;
        }
    }

    setCooldown(player: ServerPlayer, cooldown: number) {
        player.setCooldown(cooldown * this.cooldownCoef);
    }

    processMove({tile, num}: {tile: Tile, num: number}, team: Team) {
        const player = team.getMembers()[num - 1];
        if (!this.isValidCell(player.x, player.y, tile.x, tile.y)) {
            console.log(`Invalid move from ${player.x},${player.y} to ${tile.x},${tile.y}!`);
            return;
        }
        if (!player.canAct() || !player.canMoveTo(tile.x, tile.y)) {
            console.log(`Player ${num} cannot move to ${tile.x},${tile.y}!`);
            return;
        }
        
        this.freeCell(player.x, player.y);
        player.updatePos(tile.x, tile.y);
        this.occupyCell(player.x, player.y, player);

        const cooldown = player.getCooldown('move');
        this.setCooldown(player, cooldown);
        
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
        const opponent = opponentTeam.getMembers()[target - 1];
        
        if (
            !player.canAct() || 
            !player.isNextTo(opponent.x, opponent.y) || 
            !opponent.isAlive()
        ) return;
        
        const damage = this.calculateDamage(player, opponent);
        opponent.takeDamage(damage);
        player.increaseDamageDealt(damage);
        
        const cooldown = player.getCooldown('attack');
        this.setCooldown(player, cooldown);

        this.broadcast('attack', {
            team: team.id,
            target,
            num,
            damage: -damage,
            hp: opponent.getHP(),
        });

        team.socket?.emit('cooldown', {
            num,
            cooldown,
        });
    }

    processUseItem({num, index}: {num: number, index: number}, team: Team) {
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) return;

        const item = player.getItemAtIndex(index);
        if (!item) return;
        if (!player.getItemQuantity(item)) return;
        
        const cooldown = item?.cooldown * 1000;
        this.setCooldown(player, cooldown);

        const newQuantity = player.removeItem(item, 1);
        item.applyEffect(player);
        const hp = player.getHP();

        this.broadcast('useitem', {
            team: team.id,
            num,
            animation: item.animation,
            name: item.name,
            sfx: item.sfx,
        });

        if (player.HPHasChanged()) {
            this.broadcastHPchange(team, num, hp);
        }

        if (player.MPHasChanged()) {
            this.emitMPchange(team, num, player.getMP());
        }

        team.socket?.emit('cooldown', {
            num,
            cooldown,
        });

        team.socket?.emit('itemnb', {
            num,
            index,
            newQuantity,
        });
    }

    processSkill({num, x, y, index}: {num: number, x: number, y: number, index: number}, team: Team ) {
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) {
            console.log('cannot act');
            return;
        }

        if (index >= player.spells.length) return;
        const spell = player.spells[index];

        if (spell.cost > player.getMP()) return;
        const mp = player.consumeMP(spell.cost);

        const cooldown = spell?.cooldown * 1000;
        this.setCooldown(player, cooldown);

        this.broadcast('cast', {
            team: team.id,
            num,
            name: spell.name,
            location: {x, y, size: spell.size},
            delay: spell.castTime,
        });

        this.emitMPchange(team, num, mp);

        // Display danger zone

        player.setCasting(true);
        setTimeout(() => {
            const targets = this.getPlayersInArea(x, y, Math.floor(spell.size/2));
            spell.applyEffect(player, targets);
            player.setCasting(false);

            targets.forEach(target => {
                if (target.HPHasChanged()) {
                    player.increaseDamageDealt(target.getHPDelta());
                    this.broadcastHPchange(target.team!, target.num, target.getHP(), target.getHPDelta());
                }
            });            
            
            this.broadcast('localanimation', {
                x,
                y,
                animation: spell.animation,
                shake: spell.shake,
                sfx: spell.sfx,
            });

            team.socket?.emit('cooldown', {
                num,
                cooldown,
            });

            this.broadcast('endcast', {
                team: team.id,
                num
            });
        }, spell.castTime * 1000);
    }

    broadcastHPchange(team: Team, num: number, hp: number, damage?: number) {
        this.broadcast('hpchange', {
            team: team.id,
            num,
            hp,
            damage
        });
    }

    emitMPchange(team: Team, num: number, mp: number) {
        team.socket?.emit('mpchange', {
            num,
            mp,
        });
    }

    listAdjacentEnemies(player: ServerPlayer): ServerPlayer[] {
        const adjacentEnemies: ServerPlayer[] = [];
        const oppositeTeamId = player.team!.id === 1 ? 2 : 1;
        const oppositeTeam = this.teams.get(oppositeTeamId)!;
        oppositeTeam.getMembers().forEach(enemy => {
            if (player.isNextTo(enemy.x, enemy.y) && enemy.isAlive()) {
                adjacentEnemies.push(enemy);
            }
        });
        return adjacentEnemies;
    }

    listAllEnemies(player: ServerPlayer): ServerPlayer[] {
        const oppositeTeamId = player.team!.id === 1 ? 2 : 1;
        const oppositeTeam = this.teams.get(oppositeTeamId)!;
        // Filter for alive enemies
        return oppositeTeam.getMembers().filter(enemy => enemy.isAlive());
    }

    listAllAllies(player: ServerPlayer): ServerPlayer[] {
        // Filter for alive allies
        return player.team!.getMembers().filter(ally => ally.isAlive());
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
        if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) return true;
        const v = 3;
        const skip = y < this.gridHeight/2 ? Math.max(0, v - y - 1) : Math.max(0, y - (this.gridHeight - v));
        // Skip drawing the corners to create an oval shape
        return (x < skip || x >= this.gridWidth - skip);
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

    nbPlayersInArea(team: Team, gridX: number, gridY: number, radius: number) {
        let nb = 0;
        team.getMembers().forEach(player => {
            if (player.isAlive() && player.isInArea(gridX, gridY, radius)) {
                nb++;
            }
        });
        return nb;
    }

    scanGridForAoE(player: ServerPlayer, radius: number, minScore: number = 0) {
        let bestScore = -Infinity;
        let bestTile = {x: 0, y: 0};
        for(let x = 0; x < this.gridWidth; x++) {
            for(let y = 0; y < this.gridHeight; y++) {
                if (this.isSkip(x, y)) continue;
                const otherTeam = this.getOtherTeam(player.team!.id);
                const nbEnemies = this.nbPlayersInArea(otherTeam, x, y, radius);
                const nbAllies = this.nbPlayersInArea(player.team!, x, y, radius);
                const score = nbEnemies - nbAllies;

                if (score > bestScore) {
                    bestScore = score;
                    bestTile = {x, y};
                }
            }
        }
        if (bestScore >= minScore) {
            return bestTile;
        } else {
            return null;
        }
    }
}

interface Tile {
    x: number;
    y: number;
}