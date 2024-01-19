import { Socket, Server } from 'socket.io';
import { uuid } from 'uuidv4';

import { ServerPlayer } from './ServerPlayer';
import { Team } from './Team';
import { Spell } from './Spell';
import { lineOfSight } from '@legion/shared/utils';
import {apiFetch} from './API';
import { RewardsData, Terrain } from '@legion/shared/types';


export abstract class Game
{
    id: string = uuid();
    teams: Map<number, Team> = new Map<number, Team>();
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();
    terrainMap = new Map<string, Terrain>();
    io: Server;
    sockets: Socket[] = [];
    tickTimer: NodeJS.Timeout | null = null;
    socketMap = new Map<Socket, Team>();
    startTime: number = Date.now();
    duration: number = 0;
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

        sockets.forEach((socket, index) => {
            this.socketMap.set(socket, this.teams.get(index + 1)!);
            this.teams.get(index + 1)?.setSocket(socket);
        });
    }

    abstract populateTeams(): void;

    async start() {
        try {
            await this.populateTeams();
            this.populateGrid();
            this.sendGameStart();
        } catch (error) {
            this.endGame(-1);
            console.error(error);
        }
    }

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
        this.startTime = Date.now();
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

    getPlayerAt(x: number, y: number): ServerPlayer | null {
        return this.gridMap.get(`${x},${y}`) || null;
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

        team!.incrementActions();
        team!.snapshotScore();

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
                this.processMagic(data, team!);
                break;
        }

        team!.sendScore();
    }

    checkEndGame() {
        if (this.teams.get(1)!.isDefeated() || this.teams.get(2)!.isDefeated()) {
            this.endGame(this.teams.get(1).isDefeated() ? 2 : 1);
        }
    }

    handleDisconnect(socket: Socket) {
        const disconnectingTeam = this.socketMap.get(socket);
        if (!this.gameOver) {
            this.endGame(this.getOtherTeam(disconnectingTeam.id).id);
        }
    }

    endGame(winner: number) {
        // console.log(`Team ${winner} wins!`);
        this.duration = Date.now() - this.startTime;
        this.gameOver = true;

        this.sockets.forEach(socket => {
            const team = this.socketMap.get(socket);
            const rewards = this.computeGameEndRewards(team, winner, this.duration);
            this.writeRewardsToDb(team, rewards);
            socket.emit('gameEnd', rewards);
        });
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

    processUseItem({num, x, y, index}: {num: number, x: number, y: number, index: number}, team: Team) {
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) return;

        const item = player.getItemAtIndex(index);
        if (!item) return;
        
        const cooldown = item?.cooldown * 1000;
        this.setCooldown(player, cooldown);

        player.removeItem(item);
        const targets = item.getTargets(this, player, x, y);
        // console.log(`Item ${item.name} found ${targets.length} targets`);
        item.applyEffect(targets);

        this.broadcast('useitem', {
            team: team.id,
            num,
            animation: item.animation,
            name: item.name,
            sfx: item.sfx,
        });

        targets.forEach(target => {
            if (target.HPHasChanged()) {
                this.broadcastHPchange(target.team!, target.num, target.getHP(), target.getHPDelta());
            }
            if (target.MPHasChanged()) {
                this.emitMPchange(target.team!, target.num, target.getMP());
            }
        });    

        team.socket?.emit('cooldown', {
            num,
            cooldown,
        });

        team.socket?.emit('inventory', {
            num,
            inventory: player.getNetworkInventory(),
        });
    }

    applyMagic(spell: Spell, player: ServerPlayer, x: number, y: number, team: Team) {
        const targets = spell.getTargets(this, x, y);
        // console.log(`Spell ${spell.name} found ${targets.length} targets`);
        spell.applyEffect(player, targets);
        player.setCasting(false);

        targets.forEach(target => {
            if (target.HPHasChanged()) {
                const delta = target.getHPDelta();
                player.increaseDamageDealt(delta);
                if (!target.isAlive()) player.team!.increaseScoreFromKill(player);
                if (delta < 0) player.team!.increaseScoreFromDamage(-delta);
                this.broadcastHPchange(target.team!, target.num, target.getHP(), target.getHPDelta());
            }
        });            
        player.team!.increaseScoreFromMultiHits(targets.length);
        player.team!.increaseScoreFromSpell(spell.score);

        if (spell.terrain) {
            for (let i = x - Math.floor(spell.size/2); i <= x + Math.floor(spell.size/2); i++) {
                for (let j = y - Math.floor(spell.size/2); j <= y + Math.floor(spell.size/2); j++) {
                    this.terrainMap.set(`${i},${j}`, spell.terrain);
                }
            }
            this.broadcast('terrain', {
                x,
                y,
                size: spell.size,
                type: spell.terrain,
            });
        }
        
        this.broadcast('localanimation', {
            x,
            y,
            id: spell.id,
        });

        team.socket?.emit('cooldown', {
            num: player.num,
            cooldown: spell.cooldown * 1000,
        });

        this.broadcast('endcast', {
            team: team.id,
            num: player.num
        });
        
        team.sendScore();
    }

    processMagic({num, x, y, index}: {num: number, x: number, y: number, index: number}, team: Team ) {
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) {
            console.log('cannot act');
            return;
        }

        const spell: Spell | null = player.getSpellAtIndex(index);
        if (!spell) {
            console.log('no spell');
            return;
        }

        if (spell.cost > player.getMP()) return;
        const mp = player.consumeMP(spell.cost);

        const cooldown = spell?.cooldown * 1000;
        this.setCooldown(player, cooldown);

        this.broadcast('cast', {
            team: team.id,
            num,
            id: spell.id,
            location: {x, y},
        });

        this.emitMPchange(team, num, mp);
        player.setCasting(true);

        setTimeout(this.applyMagic.bind(this, spell, player, x, y, team), spell.castTime * 1000);
    }

    broadcastScoreChange(team: Team) {
        this.broadcast('score', {
            teamId: team.id,
            score: team.score,
        });
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
        && lineOfSight(fromX, fromY, toX, toY, this.isFree.bind(this));
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

    computeGameEndRewards(team: Team, winnerTeamId: number, duration: number): RewardsData {
        if (team.id === winnerTeamId) {
            return {
                isWinner: true,
                gold: this.computeTeamGold(team),
                xp: this.computeTeamXP(team, this.getOtherTeam(team.id), duration, true),
            }
        } else {
            return {
                isWinner: false,
                gold: 0,
                xp: this.computeTeamXP(team, this.getOtherTeam(team.id), duration, false)
            }
        }
    }

    computeTeamGold(team: Team) {
        return Math.max(Math.ceil(team.score/20), 10);
    }

    computeLevelDifference(team: Team, otherTeam: Team) {
        const teamLevel = team.getMembers().reduce((sum, player) => sum + player.level, 0);
        const otherTeamLevel = otherTeam.getMembers().reduce((sum, player) => sum + player.level, 0);
        return teamLevel - otherTeamLevel;
    }

    computeTeamXP(team: Team, otherTeam: Team, gameDuration: number, isWinner: boolean) {
        const baseXP = 100;
        const winningCoefficient = 1.2;
        const losingCoefficient = 0.8;
        const levelDifferenceConstant = 10; // At what level differnce does the level coefficient become 2
        const actionsConstant = 50;
        const minDuration = 120;
        const teamLevelDifference = this.computeLevelDifference(team, otherTeam);
        const totalActions = team.actions; 

        // Calculate factors
        const levelFactor = Math.max(1 + (teamLevelDifference / levelDifferenceConstant), 0.1);
        const actionFactor = 1 + (totalActions / actionsConstant);
        const durationFactor = gameDuration < minDuration ? gameDuration / minDuration : 1;

        // Calculate base XP
        let xp = baseXP * levelFactor * actionFactor * durationFactor;

        // Apply winning or losing coefficient
        xp *= isWinner ? winningCoefficient : losingCoefficient;

        return Math.round(xp); // Round to nearest whole number
    }

    async writeRewardsToDb(team: Team, rewards: RewardsData) {
        try {
            await apiFetch(
                'rewardsUpdate',
                team.getFirebaseToken(),
                {
                    method: 'POST',
                    body: rewards,
                }
            );
        } catch (error) {
            console.error(error);
        }
    }
}

interface Tile {
    x: number;
    y: number;
}