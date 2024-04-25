import { Socket, Server } from 'socket.io';

import { ServerPlayer } from './ServerPlayer';
import { Team } from './Team';
import { Spell } from './Spell';
import { lineOfSight, listCellsOnTheWay } from '@legion/shared/utils';
import {apiFetch} from './API';
import { Terrain, PlayMode, Target, StatusEffect } from '@legion/shared/enums';
import { OutcomeData, TerrainUpdate, ChestsData, ChestsKeysData } from '@legion/shared/interfaces';

export abstract class Game
{
    id: string;
    mode: PlayMode;
    teams: Map<number, Team> = new Map<number, Team>();
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();
    terrainMap = new Map<string, Terrain>();
    io: Server;
    sockets: Socket[] = [];
    tickTimer: NodeJS.Timeout | null = null;
    socketMap = new Map<Socket, Team>();
    startTime: number = Date.now();
    duration: number = 0;
    gameStarted: boolean = false;
    gameOver: boolean = false;
    cooldownCoef: number = 1;

    gridWidth: number = 20;
    gridHeight: number = 10;

    constructor(id: string, mode: PlayMode, io: Server) {
        this.id = id;
        this.mode = mode;
        this.io = io;

        this.teams.set(1, new Team(1, this));
        this.teams.set(2, new Team(2, this));
        console.log(`Created game ${this.id}`);
    }

    addPlayer(socket: Socket, elo: number, chests: ChestsData) {
        try {
            if (this.sockets.length === 2) return;
            this.sockets.push(socket);
            socket.join(this.id);
            const index = this.sockets.indexOf(socket);
            console.log(`Adding player ${index + 1} to game ${this.id}`);
            const team = this.teams.get(index + 1);
            this.socketMap.set(socket, team);
            team.setSocket(socket);
            team.setElo(elo);
            if (this.mode != PlayMode.PRACTICE) team.registerChestsData(chests);
        } catch (error) {
            console.error(error);
        }
    }

    abstract populateTeams(): void;

    async start() {
        console.log(`Starting game ${this.id}`);
        try {
            await this.populateTeams();
            this.populateGrid();
            this.sendGameStart();
        } catch (error) {
            this.endGame(-1);
            console.error(error);
        }
    }

    getPosition(index, flip) {
        const positions = [
            {x: 15, y: 3},
            {x: 15, y: 5},
            {x: 17, y: 4},
            {x: 17, y: 2},
            {x: 17, y: 6},
            {x: 15, y: 1},
            {x: 15, y: 7},
            {x: 19, y: 2},
            {x: 19, y: 4},
            {x: 19, y: 6},
        ]
        const position = positions[index];
        if (flip) {
            position.x = 19 - position.x;
        }
        return position;
    }

    isFree(gridX: number, gridY: number) {
        return !this.gridMap.get(`${gridX},${gridY}`) && !this.hasObstacle(gridX, gridY);
    }

    hasObstacle(gridX: number, gridY: number) {
        return this.terrainMap.get(`${gridX},${gridY}`) === Terrain.ICE;
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
        this.gameStarted = true;
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
        console.log(`Processing action ${action} with data ${JSON.stringify(data)}`);
        if (this.gameOver || !this.gameStarted) return;

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
            case 'obstacleattack':
                this.processObstacleAttack(data, team!);
                break;
            case 'useitem':
                this.processUseItem(data, team!);
                break;
            case 'spell':
                this.processMagic(data, team!);
                break;
        }

        team!.sendScore();
    }

    checkEndGame() {
        if (this.gameOver) return;
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
        console.log(`Team ${winner} wins!`);
        this.duration = Date.now() - this.startTime;
        this.gameOver = true;

        this.teams.forEach(team => {
            team.clearAllTimers();
        }, this);

        this.sockets.forEach(socket => {
            const team = this.socketMap.get(socket);
            const otherTeam = this.getOtherTeam(team!.id);
            const outcomes = this.computeGameOutcomes(team, otherTeam, winner, this.duration, this.mode);
            console.log(`Team ${team!.id} outcomes: ${JSON.stringify(outcomes)}`);
            team.distributeXp(outcomes.xp);
            this.writeOutcomesToDb(team, outcomes);
            socket.emit('gameEnd', outcomes);
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

        player.stopDoT();
        
        // console.log(`Cells on the way: ${JSON.stringify(Array.from(listCellsOnTheWay(player.x, player.y, tile.x, tile.y)))}`);
        this.checkForTerrainEffects(player, listCellsOnTheWay(player.x, player.y, tile.x, tile.y));

        this.freeCell(player.x, player.y);
        player.updatePos(tile.x, tile.y);
        this.occupyCell(player.x, player.y, player);
        
        this.checkForStandingOnTerrain(player);

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

    // Called when traversing cells with terrain effects
    checkForTerrainEffects(player: ServerPlayer, cells: Set<string>) {
        cells.forEach(cell => {
            const terrain = this.terrainMap.get(cell);
            if (terrain) {
                player.applyTerrainEffect(terrain);
            }
        });
    }

    // Apply when ending on cell with terrain effect
    checkForStandingOnTerrain(player: ServerPlayer) {
        const terrain = this.terrainMap.get(`${player.x},${player.y}`);
        if (terrain) {
            player.setUpTerrainEffect(terrain);
        }
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
        player.team.incrementOffensiveActions();

        if (this.hasObstacle(opponent.x, opponent.y)) {
            const terrainUpdate = this.removeTerrain(opponent.x, opponent.y);
            this.broadcastTerrain([terrainUpdate]);
            opponent.removeStatusEffect(StatusEffect.FREEZE);
        }
        
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

    processObstacleAttack({num, x, y}: {num: number, x: number, y: number}, team: Team) {
        const player = team.getMembers()[num - 1];
        
        if (
            !player.canAct() || 
            !player.isNextTo(x, y) || 
            !this.hasObstacle(x, y)
        ) return;

        const cooldown = player.getCooldown('attack');
        this.setCooldown(player, cooldown);

        const terrainUpdate = this.removeTerrain(x, y);
        this.broadcastTerrain([terrainUpdate]);

        this.broadcast('obstacleattack', {
            team: team.id,
            num,
            x, y,
        });

        team.socket?.emit('cooldown', {
            num,
            cooldown,
        });
    }

    processUseItem({num, x, y, index, targetTeam, target}: {num: number, x: number, y: number, index: number,  targetTeam: number, target: number | null}, team: Team) {
        console.log(`Processing item for team ${team.id}, player ${num}, item ${index}, target team ${targetTeam}, target ${target}`)
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) return;

        const item = player.getItemAtIndex(index);
        if (!item) return;

        let targetPlayer: ServerPlayer | null = null;
        if (item.target === Target.SINGLE) {
            targetPlayer = this.teams.get(targetTeam)?.getMembers()[target - 1];
            if (!targetPlayer) {
                console.log('Invalid target!');
                return;
            }
        }
        const targets = targetPlayer ? [targetPlayer] : item.getTargets(this, player, x, y);

        // Only check if the item is applicable if there is a single target
        if (targets.length == 1 && !item.effectsAreApplicable(targets[0])) {
            console.log(`Item ${item.name} is not applicable!`);
            return;
        };

        item.applyEffect(targets);

        const cooldown = item?.cooldown * 1000;
        this.setCooldown(player, cooldown);

        player.removeItem(item);

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
                target.team.incrementHealing(target.getHPDelta());
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

    applyMagic(spell: Spell, player: ServerPlayer, x: number, y: number, team: Team, targetPlayer: ServerPlayer | null) {
        const targets = targetPlayer ? [targetPlayer] : spell.getTargets(this, x, y);
        // console.log(`Spell ${spell.name} found ${targets.length} targets`);
        spell.applyEffect(player, targets);
        player.setCasting(false);

        let isKill = false;
        targets.forEach(target => {
            if (target.HPHasChanged()) {
                const delta = target.getHPDelta();
                player.increaseDamageDealt(delta);
                if (!target.isAlive()){
                    // player.team!.increaseScoreFromKill(player);
                    isKill = true;
                }
                // if (delta < 0) player.team!.increaseScoreFromDamage(-delta);
                if (delta > 0) player.team!.incrementHealing(delta);
            }
        });            
        player.team!.increaseScoreFromMultiHits(targets.length);
        player.team!.increaseScoreFromSpell(spell.score);

        if (spell.terrain) {
            const terrainUpdates = this.manageTerrain(spell, x, y);
            this.broadcastTerrain(terrainUpdates);
        }

        if (spell.status) {
            targets.forEach(target => {
                target.addStatusEffect(spell.status.effect, spell.status.duration, spell.status.chance);
            });
        }
        
        this.broadcast('localanimation', {
            x,
            y,
            id: spell.id,
            isKill,
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

    processMagic({num, x, y, index, targetTeam, target}: {num: number, x: number, y: number, index: number, targetTeam: number, target: number}, team: Team ) {
        console.log(`Processing magic for team ${team.id}, player ${num}, spell ${index}, target team ${targetTeam}, target ${target}`);
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) {
            console.log('cannot act');
            return;
        }

        const spell: Spell | null = player.getSpellAtIndex(index);
        if (!spell) return;

        if (spell.cost > player.getMP()) return;
        const mp = player.consumeMP(spell.cost);

        const cooldown = spell?.cooldown * 1000;
        this.setCooldown(player, cooldown);

        let targetPlayer: ServerPlayer | null = null;
        if (spell.target === Target.SINGLE) {
            targetPlayer = this.teams.get(targetTeam)?.getMembers()[target - 1];
            if (!targetPlayer || !targetPlayer.isAlive()) return;
            x = targetPlayer.x;
            y = targetPlayer.y;
        }

        if (!spell.isHealingSpell()) player.team.incrementOffensiveActions();

        this.broadcast('cast', {
            team: team.id,
            num,
            id: spell.id,
            location: {x, y},
        });

        this.emitMPchange(team, num, mp);
        player.setCasting(true);

        setTimeout(this.applyMagic.bind(this, spell, player, x, y, team, targetPlayer), spell.castTime * 1000);
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

    broadcastStatusEffectChange(team: Team, num: number, statuses) {
        this.broadcast('statuseffectchange', {
            team: team.id,
            num,
            statuses,
        });
    }

    emitMPchange(team: Team, num: number, mp: number) {
        team.socket?.emit('mpchange', {
            num,
            mp,
        });
    }

    manageTerrain(spell: Spell, x: number, y: number) {
        const terrainUpdates: TerrainUpdate[] = [];
        for (let i = x - Math.floor(spell.size/2); i <= x + Math.floor(spell.size/2); i++) {
            for (let j = y - Math.floor(spell.size/2); j <= y + Math.floor(spell.size/2); j++) {

                const existingTerrain = this.terrainMap.get(`${i},${j}`);
                if (existingTerrain && (existingTerrain == Terrain.ICE && spell.terrain == Terrain.FIRE
                    || existingTerrain == Terrain.FIRE && spell.terrain == Terrain.ICE)) {
                    this.terrainMap.delete(`${i},${j}`);
                } else {
                    this.terrainMap.set(`${i},${j}`, spell.terrain);
                }

                terrainUpdates.push({
                    x: i,
                    y: j,
                    terrain: this.terrainMap.get(`${i},${j}`) || Terrain.NONE,
                });

                const player = this.getPlayerAt(i, j);
                if (player) player.setUpTerrainEffect(this.terrainMap.get(`${player.x},${player.y}`) || Terrain.NONE);
            }
        }
        return terrainUpdates;
    }

    removeTerrain(x: number, y: number) {
        this.terrainMap.delete(`${x},${y}`);
        return {
            x,
            y,
            terrain: this.terrainMap.get(`${x},${y}`) || Terrain.NONE,
        }
    }

    broadcastTerrain(terrainUpdates: TerrainUpdate[]) {
        this.broadcast('terrain', terrainUpdates);
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
        && !this.hasObstacle(toX, toY)
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

    computeGameOutcomes(team: Team, otherTeam: Team, winnerTeamId: number, duration: number, mode: PlayMode): OutcomeData {
        const isWinner = team.id === winnerTeamId;
        const eloUpdate = mode == PlayMode.RANKED ? this.updateElo(isWinner ? team : otherTeam, isWinner ? otherTeam : team) : {winnerUpdate: 0, loserUpdate: 0};
        const grade = this.computeGrade(team, otherTeam);
        console.log(`Game grade for team ${team.id}: ${grade}`);
        return {
            isWinner,
            gold: isWinner ? this.computeTeamGold(team) : 0,
            xp: this.computeTeamXP(team, otherTeam, duration, false),
            elo: isWinner ? eloUpdate.winnerUpdate : eloUpdate.loserUpdate,
            chestsRewards: mode == PlayMode.PRACTICE ? null : team.getChestsRewards() as ChestsKeysData,
        }
    }

    computeGrade(team: Team, otherTeam: Team) {
        const score = 0;
        const hpFactor = team.getHPLeft() / team.getTotalHP();
        const healingFactor = -(team.getHealedAmount() / (team.getHealedAmount() + otherTeam.getHealedAmount()));
        const offenseFactor = -(team.getOffensiveActions() / (team.getOffensiveActions() + otherTeam.getOffensiveActions()));
    }

    updateElo(winningTeam: Team, losingTeam: Team): { winnerUpdate: number, loserUpdate: number } {
        const K_FACTOR = 30;

        const expectedScoreWinner = 1 / (1 + Math.pow(10, (losingTeam.elo - winningTeam.elo) / 400));
        const expectedScoreLoser = 1 / (1 + Math.pow(10, (winningTeam.elo - losingTeam.elo) / 400));
    
        // Since it's a match, winner's actual score is 1 and loser's actual score is 0
        const actualScoreWinner = 1;
        const actualScoreLoser = 0;
    
        // Calculate rating updates
        const winnerUpdate = K_FACTOR * (actualScoreWinner - expectedScoreWinner);
        const loserUpdate = K_FACTOR * (actualScoreLoser - expectedScoreLoser);
    
        // Return the elo update for each team
        return {
          winnerUpdate: winnerUpdate,
          loserUpdate: loserUpdate
        };
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

    async writeOutcomesToDb(team: Team, rewards: OutcomeData) {
        console.log('Writing rewards to DB');
        try {
            await apiFetch(
                'rewardsUpdate',
                team.getFirebaseToken(),
                {
                    method: 'POST',
                    body: {
                        isWinner: rewards.isWinner,
                        gold: rewards.gold,
                        xp: rewards.xp,
                        elo: rewards.elo,
                        characters: team.getCharactersDBUpdates(),
                        chestsRewards: rewards.chestsRewards,
                    } as OutcomeData,
                }
            );
        } catch (error) {
            console.error(error);
        }
    }

    async saveInventoryToDb(token: string, characterId: string, inventory: number[]) {
        console.log('Saving inventory to DB');
        try {
            await apiFetch(
                'inventorySave',
                token,
                {
                    method: 'POST',
                    body: {
                        characterId,
                        inventory,
                    },
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

