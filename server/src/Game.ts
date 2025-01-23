import { Socket, Server } from 'socket.io';
import * as admin from 'firebase-admin';

import { ServerPlayer } from './ServerPlayer';
import { Team } from './Team';
import { Spell } from './Spell';
import { lineOfSight, listCellsOnTheWay } from '@legion/shared/utils';
import { apiFetch, getRemoteConfig } from './API';
import { Terrain, PlayMode, Target, StatusEffect, ChestColor, League, GEN,
    Stat, SpeedClass } from '@legion/shared/enums';
import { OutcomeData, TerrainUpdate, PlayerDataForGame, GameOutcomeReward, GameData,
    EndGameDataResults, GameReplayMessage, CharacterData } from '@legion/shared/interfaces';
import { getChestContent } from '@legion/shared/chests';
import { AVERAGE_GOLD_REWARD_PER_GAME, XP_PER_LEVEL, CAST_DELAY,
    PRACTICE_XP_COEF, PRACTICE_GOLD_COEF, RANKED_XP_COEF, RANKED_GOLD_COEF, remoteConfig,
    LEGION_CUT, TURN_DURATION, KILL_CAM_DURATION, MOVE_DELAY, ATTACK_DELAY, SPELL_DELAY,
    ITEM_DELAY, KILL_CAM_DELAY } from '@legion/shared/config';
import { TerrainManager } from './TerrainManager';
import { TurnSystem } from './TurnSystem';
import { withRetry } from './utils';


enum GameAction {
    SPELL_USE,
    ITEM_USE,
    MOVE,
    ATTACK
}
export abstract class Game
{
    id: string;
    mode: PlayMode;
    stake: number = 0;
    league: League;
    teams: Map<number, Team> = new Map<number, Team>();
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();
    terrainManager = new TerrainManager(this);
    io: Server;
    sockets: Socket[] = [];
    socketMap = new Map<Socket, Team>();
    turnSystem: TurnSystem;
    turnee: ServerPlayer | null = null;
    startTime: number = Date.now();
    duration: number = 0;
    gameStarted: boolean = false;
    firstBlood: boolean = false;
    gameOver: boolean = false;
    turnTimer: NodeJS.Timeout | null = null;
    audienceTimer: NodeJS.Timeout | null = null;
    checkEndTimer: NodeJS.Timeout | null = null;
    config: any;
    tutorialSettings: any;
    GENhistory: Set<GEN> = new Set<GEN>();
    turnStart: number = 0;
    turnDuration: number = 0;
    turnNumber: number = 0;
    gridWidth: number = 20;
    gridHeight: number = 10;

    replayMessages: GameReplayMessage[] = [];

    constructor(id: string, mode: PlayMode, league: League, io: Server) {
        this.id = id;
        this.mode = mode;
        this.league = league;
        this.io = io;
        this.turnDuration = TURN_DURATION;

        this.teams.set(1, new Team(1, this));
        this.teams.set(2, new Team(2, this));

        this.tutorialSettings = {
            allowVictoryConditions: false,
            shortCooldowns: true,
        }
        console.log(`[Game] Created game ${this.id}`);
    }

    addSocket(socket: Socket) {
        this.sockets.push(socket);
        socket.join(this.id);
    }

    addPlayer(socket: Socket, playerData: PlayerDataForGame) {
        try {
            if (this.sockets.length === 2) return;
            this.addSocket(socket);
            const index = this.sockets.indexOf(socket);
            // console.log(`[Game:addPlayer] Adding player ${index + 1} to game ${this.id}`);

            const team = this.teams.get(index + 1);
            // console.log(`[Game:addPlayer] Player ${playerData.name} assigned to team ${team.id}`);
            this.socketMap.set(socket, team);
            team.setSocket(socket);
            team.setPlayerData(playerData);
        } catch (error) {
            console.error(error);
        }
    }

    handleDisconnect(socket: Socket) {
        const disconnectingTeam = this.socketMap.get(socket);
        disconnectingTeam.unsetSocket();
        // Slice the player from the game
        this.sockets = this.sockets.filter(s => s !== socket);
    }

    reconnectPlayer(socket: Socket) {
        console.log(`Reconnecting player to game ${this.id} ...`)
        this.addSocket(socket);
        // Find which team has socket set to null
        const team = this.teams.get(1).socket ? this.teams.get(2) : this.teams.get(1);
        this.socketMap.set(socket, team);
        team?.setSocket(socket);
        this.sendGameStatus(socket, true);
    }

    abstract populateTeams(): void;

    async start() {
        console.log(`[Game:start]`);
        try {
            await this.getRemoteConfig();
            await this.populateTeams();
            this.populateGrid();
            this.startGame();
        } catch (error) {
            this.endGame(-1);
            console.error(error);
        }
    }

    async getRemoteConfig() {
        const isDev = process.env.NODE_ENV === 'development';
        this.config = isDev ? remoteConfig : await getRemoteConfig();
        // console.log(`[Game:getRemoteConfig] [isDev: ${isDev}] ${JSON.stringify(this.config)}`);
    }

    getPosition(index, flip) {
        const positions = [
            {x: 4, y: 3},
            {x: 4, y: 5},
            {x: 2, y: 4},
            {x: 2, y: 2},
            {x: 2, y: 6},
            {x: 4, y: 1},
            {x: 4, y: 7},
            {x: 0, y: 2},
            {x: 0, y: 4},
            {x: 0, y: 6},
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
        return this.terrainManager.terrainMap.get(`${gridX},${gridY}`) === Terrain.ICE;
    }

    freeCell(gridX: number, gridY: number) {
        this.gridMap.delete(`${gridX},${gridY}`);
    }

    occupyCell(gridX: number, gridY: number, player: ServerPlayer) {
        this.gridMap.set(`${gridX},${gridY}`, player);
    }

    listCellsAround(gridX: number, gridY: number) {
        const cells = new Set<{x: number, y: number}>();
        const offsets = [
            {x: -1, y: 0},  // Left
            {x: -1, y: -1}, // Top-left
            {x: 0, y: -1},  // Top
            {x: 1, y: -1},  // Top-right
            {x: 1, y: 0},   // Right
            {x: 1, y: 1},   // Bottom-right
            {x: 0, y: 1},   // Bottom
            {x: -1, y: 1},  // Bottom-left
        ];

        for (const offset of offsets) {
            cells.add({x: gridX + offset.x, y: gridY + offset.y});
        }

        return cells;
    }

    findFreeCellNear(gridX: number, gridY: number, noFire: boolean = false) {
        // Perform a BFS to find the nearest free cell
        const queue = [{x: gridX, y: gridY}];
        const visited = new Set<{x: number, y: number}>();
        visited.add({x: gridX, y: gridY});

        while (queue.length > 0) {
            const {x, y} = queue.shift()!;
            if (this.isFree(x, y) && (!noFire || !this.checkIsOnFlame(x, y))) {
                return {x, y};
            }
            const neighbors = this.listCellsAround(x, y);
            neighbors.forEach(neighbor => {
                if (!visited.has(neighbor) && !this.isSkip(neighbor.x, neighbor.y)) {
                    queue.push(neighbor);
                    visited.add(neighbor);
                }
            });
        }
        return null;
    }

    populateGrid() {
        // Iterate over teams
        this.teams.forEach(team => {
            team.getMembers().forEach(player => {
                this.occupyCell(player.x, player.y, player);
            }, this);
        }, this);
    }

    startGame() {
        console.log(`[Game:startGame]`)
        this.startTime = Date.now();
        this.gameStarted = true;

        this.turnSystem = new TurnSystem();
        const allCharacters = this.getTeam(1).concat(this.getTeam(2));
        this.turnSystem.initializeTurnOrder(allCharacters);

        this.saveInitialStateToReplay();
        this.sockets.forEach(socket => {
            this.sendGameStatus(socket);
            this.incrementStartedGames(this.socketMap.get(socket)!);
        });
        setTimeout(this.processTurn.bind(this), 2000);
        
        this.audienceTimer = setInterval(() => {
            this.teams.forEach(team => {
                team.incrementScore(10);
                team!.sendScore();
            });
        }, 30 * 1000);

        this.checkEndTimer = setInterval(() => {
            this.checkEndGame();
        }, 1000);

        if (this.config.AUTO_DEFEAT) {
            setTimeout(() => {
                this.endGame(2);
            }, 5000);
        }
    }

    saveInitialStateToReplay() {
        const timestamp = Date.now() - this.startTime;
        this.replayMessages.push({
            timestamp,
            event: 'gameStatus',
            data: this.getGameData(1, true)
        });
    }

    resetTurnTimer(turnDuration: number) {
        clearTimeout(this.turnTimer!);
        this.turnStart = Date.now();
        // console.log(`[Game:resetTurnTimer] Resetting turn: ${turnDuration}`);
        this.turnTimer = setTimeout(this.processTurn.bind(this), turnDuration * 1000);
        this.turnDuration = turnDuration;

    }

    processTurn(delay: number = 0) {
        if (this.gameOver) return;
        setTimeout(() => {
            // Check if the previous turnee has acted
            if (this.turnee && !this.turnee.hasActed) {
                this.turnSystem.processAction(this.turnee, SpeedClass.NORMAL);
            }

            this.broadcastQueueData();
            this.turnee = this.turnSystem.getNextActor();
            this.turnee.setHasActed(false);

            // console.log(`[Game:processTurn] Turnee: ${this.turnee.num} from team ${this.turnee.team.id}`);

            this.turnNumber++;
            this.resetTurnTimer(this.turnDuration);
            this.broadcast('turnee', this.getTurneeData());
            this.turnee.startTurn();
        }, delay * 1000);
    }

    processPassTurn() {
        this.turnSystem.processAction(this.turnee, SpeedClass.PASS);
        this.processTurn();
    }

    processDeath(player: ServerPlayer) {
        if (this.turnee == player) {
            this.processTurn();
        }
    }

    sendGameStatus(socket: Socket, reconnect: boolean = false) {
        if (reconnect) {
            console.log(`[Game:sendGameStatus] Reconnect`);
        }
        if (reconnect && !this.gameStarted) {
            console.error(`[Game:sendGameStatus] Reconnect flag set to true for game not started`);
        }
        const teamId = this.socketMap.get(socket)?.id!;
        const gameData = this.getGameData(teamId, reconnect);
        
        socket.emit('gameStatus', gameData);
    }

    broadcastQueueData() {
        const queueData = this.turnSystem.getQueueData();
        this.broadcast('queueData', queueData);
    }

    broadcast(event: string, data: any) {
        const timestamp = Date.now() - this.startTime;
        this.replayMessages.push({
            timestamp,
            event,
            data
        });
        this.io.in(this.id).emit(event, data);
    }

    getTurneeData() {
        return {
            num: this.turnee?.num,
            team: this.turnee?.team.id,
            turnDuration: this.turnDuration,
            timeLeft: this.turnDuration - (Date.now() - this.turnStart)/1000,
            turnNumber: this.turnNumber,
        }
    }

    getGameData(playerTeamId: number, reconnect: boolean = false): GameData {
        const otherTeamId = this.getOtherTeam(playerTeamId).id;
        const team = this.teams.get(playerTeamId);
        const otherTeam = this.teams.get(otherTeamId);
        const data = {
            general: {
                reconnect,
                spectator: false,
                mode: this.mode,
            },
            queue: this.turnSystem.getQueueData(),
            turnee: this.getTurneeData(),
            player: {
                teamId: playerTeamId,
                player: team.getPlayerData(),
                team: team.getMembers().map(player => player.getPlacementData(true)),
                score: team.score,
            },
            opponent: {
                teamId: otherTeamId,
                player: otherTeam.getPlayerData(),
                team: otherTeam.getMembers().map(player => player.getPlacementData()),
                score: -1,
            },
            terrain: Array.from(this.terrainManager.terrainMap).map(([key, value]) => {
                const [x, y] = key.split(',').map(Number);
                return {x, y, terrain: value};
            }),
        }
        return data;
    }

    calculateDamage(attacker: ServerPlayer, defender: ServerPlayer) {
        if (this.config.HIGH_DAMAGE) {
            return 1000;
        }
        // Calculate the base damage
        // let baseDamage = attacker.atk - defender.def;
        let baseDamage = attacker.getStat(Stat.ATK) / (1 + defender.getStat(Stat.DEF));
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
        // Radius is the not-divided-by-2 size of the spell/item
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
        if (this.gameOver || !this.gameStarted) return;
        if (this.turnee.hasActed) return;

        let team: Team;
        if (socket) {
            team = this.socketMap.get(socket);
        } else {
            team = this.teams.get(2);
        }

        if (team.id !== this.turnee.team.id) {
            console.log(`[Game:processAction] Team ${team.id} is not the current turnee's team!`);
            return;
        }

        team!.incrementActions();
        team!.snapshotScore();

        this.turnee.setHasActed(true);

        switch (action) {
            case 'move':
                this.processMove(data);
                this.saveGameAction(team.teamData.playerUID, GameAction.MOVE, data);
                break;
            case 'attack':
                this.processAttack(data);
                this.saveGameAction(team.teamData.playerUID, GameAction.ATTACK, data);
                break;
            case 'obstacleattack':
                this.processObstacleAttack(data);
                break;
            case 'useitem':
                this.processUseItem(data);
                this.saveGameAction(team.teamData.playerUID, GameAction.ITEM_USE, data);
                break;
            case 'spell':
                this.processMagic(data);
                this.saveGameAction(team.teamData.playerUID, GameAction.SPELL_USE, data);
                break;
            case 'passTurn':
                this.processPassTurn();
                break;
        }
    }

    checkEndGame() {
        if (this.gameOver) return;
        if (this.mode == PlayMode.TUTORIAL && !this.tutorialSettings.allowVictoryConditions) return;
        if (this.teams.get(1)!.isDefeated() || this.teams.get(2)!.isDefeated()) {
            this.endGame(this.teams.get(1).isDefeated() ? 2 : 1);
        }
    }

    endGame(winnerTeamID: number) {
        try {
            console.log(`[Game:endGame] Game ${this.id} ended, mode = ${this.mode}`);
            this.duration = Date.now() - this.startTime;
            this.gameOver = true;

            clearTimeout(this.audienceTimer!);
            clearTimeout(this.checkEndTimer!);
            clearInterval(this.turnTimer!);

            const results = {};
            let winnerUID = '';
            this.teams.forEach(team => {
                const uid = team.teamData.playerUID;
                // Skip AI players
                if (!uid || typeof uid !== 'string' || uid.trim() === '') {
                    return;
                }
                const otherTeam = this.getOtherTeam(team!.id);
                const outcomes = this.computeGameOutcomes(team, otherTeam, winnerTeamID) as OutcomeData;
                team.distributeXp(outcomes.xp);
                outcomes.characters = team.getCharactersDBUpdates();
                const engagement = team.getEngagement();
                this.writeOutcomesToDb(team, outcomes, engagement);
                console.log(`[Game:endGame] Team ${team!.id} (UID: ${uid}) outcomes: ${JSON.stringify(outcomes)}`);
                team.getSocket()?.emit('gameEnd', outcomes);

                this.replayMessages.push({
                    timestamp: Date.now() - this.startTime,
                    event: 'gameEnd',
                    data: outcomes
                });

                results[team.teamData.playerUID] = {
                    audience: team.score,
                    score: outcomes.rawGrade,
                }
                if (team.id === winnerTeamID) {
                    winnerUID = team.teamData.playerUID;
                }

                if (!team.hasDisconnected()) {
                    this.incrementCompletedGames(team);
                }
            });
            this.updateGameInDB(winnerUID, results);
            this.saveReplayToDb();

        } catch (error) {
            console.error(error);
        }
    }

    processMove({tile}: {tile: Tile}) {
        const player = this.turnee;
        // console.log(`[Game:processMove] Player ${player.num} moving to ${tile.x},${tile.y}`);
        if (!player.canAct()) {
            return;
        }
        if (!this.isValidCell(player.x, player.y, tile.x, tile.y)) {
            console.log(`[Game:processMove] Invalid move from ${player.x},${player.y} to ${tile.x},${tile.y}!`);
            return;
        }
        if (!player.canMoveTo(tile.x, tile.y)) {
            console.log(`[Game:processMove] Player ${player.num} cannot move to ${tile.x},${tile.y}!`);
            return;
        }

        player.removeCurrentTerrainEffect();
        player.team.incrementMoved();
        // console.log(`Cells on the way: ${JSON.stringify(Array.from(listCellsOnTheWay(player.x, player.y, tile.x, tile.y)))}`);
        this.checkForTerrainEffects(player, listCellsOnTheWay(player.x, player.y, tile.x, tile.y));

        this.updatePlayerPosition(player, tile.x, tile.y);
        
        this.checkForStandingOnTerrain(player);
        
        this.broadcastMove(player.team, player.num, tile);

        this.turnSystem.processAction(player, SpeedClass.FAST);
        this.processTurn(MOVE_DELAY);
    }

    updatePlayerPosition(player: ServerPlayer, x: number, y: number) {
        this.freeCell(player.x, player.y);
        player.updatePos(x, y);
        this.occupyCell(player.x, player.y, player);
    }

    broadcastMove(team: Team, num: number, tile: Tile) {
        this.broadcast('move', {
            team: team.id,
            tile,
            num,
        });
    }

    // Called when traversing cells with terrain effects
    checkForTerrainEffects(player: ServerPlayer, cells: Set<string>) {
        cells.forEach(cell => {
            const terrain = this.terrainManager.terrainMap.get(cell);
            if (terrain) {
                player.applyTerrainEffect(terrain);
            }
        });
    }

    // Apply when ending on cell with terrain effect
    checkForStandingOnTerrain(player: ServerPlayer) {
        const terrain = this.terrainManager.getTerrain(player.x,player.y);
        if (terrain) {
            player.setUpTerrainEffect(terrain);
        }
    }

    checkIsOnFlame(x: number, y: number) {
        return this.terrainManager.getTerrain(x, y) === Terrain.FIRE;
    }

    processAttack({target, sameTeam}: {target: number, sameTeam: boolean}) {
        // console.log(`[Game:processAttack] Player ${this.turnee.num} attacking target ${target}`);
        const player = this.turnee;
        const opponentTeam = sameTeam ? player.team : this.getOtherTeam(player.team.id);
        const opponent = opponentTeam.getMembers()[target - 1];
        
        if (
            !player.canAct() || 
            !opponent.isAlive()
        ) {return
        };

        if (!player.isNextTo(opponent.x, opponent.y)) {
            // Find closest cell to opponent in movement range
            const cellsInRange = this.listCellsInRange(player.x, player.y, player.distance);
            if (!cellsInRange) {
                return;
            }
            const closestCell = cellsInRange.reduce((closest, cell) => {
                const distance = Math.abs(cell.x - opponent.x) + Math.abs(cell.y - opponent.y);
                return distance < Math.abs(closest.x - opponent.x) + Math.abs(closest.y - opponent.y) ? cell : closest;
            }, cellsInRange[0]);
            this.processMove({tile: closestCell});
            return;
        }
        
        const damage = this.calculateDamage(player, opponent);
        opponent.takeDamage(damage);
        
        const weapon = player.getWeapon();
        // console.log(`[Game:processAttack] Weapon: ${weapon?.name}`);
        if (weapon) {
            weapon.statusEffects?.forEach(effect => {
                opponent.addStatusEffect(effect.effect, effect.chance);
            });
        }
        
        player.increaseDamageDealt(damage);
        player.team.incrementOffensiveActions();
        player.addInteractedTarget(opponent);

        let oneShot = false;
        if (opponent.justDied) {
            oneShot = (damage >= opponent.getMaxHP());
        }

        if (this.hasObstacle(opponent.x, opponent.y)) {
            const terrainUpdates = this.terrainManager.removeIce(opponent.x, opponent.y);
            this.broadcastTerrain(terrainUpdates);
            opponent.removeStatusEffect(StatusEffect.FREEZE);
        }

        const isKill = opponent.justDied;
        this.broadcast('attack', {
            team: player.team.id,
            target,
            num: player.num,
            damage: -damage,
            hp: opponent.getHP(),
            isKill,
            sameTeam,
        });

        if (oneShot) { // Broadcast gen after attack
            this.broadcastGEN([GEN.ONE_SHOT]);
        }

        this.turnSystem.processAction(player, SpeedClass.NORMAL);
        this.processTurn(isKill ? KILL_CAM_DURATION + KILL_CAM_DELAY : ATTACK_DELAY);
    }

    processObstacleAttack({x, y}: {x: number, y: number}) {
        const player = this.turnee;
        
        if (
            !player.canAct() || 
            !player.isNextTo(x, y) || 
            !this.hasObstacle(x, y)
        ) return;

        const terrainUpdates = this.terrainManager.removeIce(x, y);
        this.broadcastTerrain(terrainUpdates);

        this.broadcast('obstacleattack', {
            team: player.team.id,
            num: player.num,
            x, y,
        });

        this.turnSystem.processAction(player, SpeedClass.NORMAL);
        this.processTurn(ATTACK_DELAY);
    }

    processUseItem(
        {x, y, index, targetTeam, target}: 
        {x: number, y: number, index: number,  targetTeam: number, target: number | null}
    ) {
        const player = this.turnee;
        console.log(`[Game:processUseItem] Player ${player.num} using item ${index}`);
        if (!player.canAct()) {
            console.log(`[Game:processUseItem] Player ${player.num} cannot act!`);
            return;
        }

        const item = player.getItemAtIndex(index);
        if (!item) {
            console.log(`[Game:processUseItem] Invalid item index ${index}!`);
            return;
        }

        let targetPlayer: ServerPlayer | null = null;
        if (item.target === Target.SINGLE) {
            targetPlayer = this.teams.get(targetTeam)?.getMembers()[target - 1];
            if (!targetPlayer) {
                console.log('[Game:processUseItem] Invalid target!');
                return;
            }
        }
        const targets = targetPlayer ? [targetPlayer] : item.getTargets(this, player, x, y);

        // Only check if the item is applicable if there is a single target
        if (targets.length == 1 && !item.effectsAreApplicable(targets[0])) {
            console.log(`[Game:processUseItem] Item ${item.name} is not applicable!`);
            return;
        };

        // Add all targets to the list of interacted targets
        targets.forEach(target => player.addInteractedTarget(target));

        const deadTargets_ = targets.filter(target => !target.isAlive()).length;
        item.applyEffect(targets);
        const deadTargets = targets.filter(target => !target.isAlive()).length;

        if (deadTargets < deadTargets_) {
            player.team!.increaseScoreFromRevive(deadTargets_ - deadTargets);
        }

        player.removeItem(item);
        player.team.incrementItemsUsed();

        this.broadcast('useitem', {
            team: player.team.id,
            num: player.num,
            animation: item.animation,
            name: item.name,
            sfx: item.sfx,
        });

        targets.forEach(target => {
            if (target.HPHasChanged()) {
                target.team.incrementHealing(target.getHPDelta());
            }
            if (target.MPHasChanged()) {
                this.emitMPchange(target.team!, target.num, target.getMP());
            }
        });    

        player.team.socket?.emit('inventory', {
            num: player.num,
            inventory: player.getNetworkInventory(),
        });

        this.turnSystem.processAction(player, item.speedClass);
        this.processTurn(ITEM_DELAY);
    }

    applyMagic(spell: Spell, player: ServerPlayer, x: number, y: number, team: Team, targetPlayer: ServerPlayer | null) {
        const targets = targetPlayer ? [targetPlayer] : spell.getTargets(this, x, y);
        spell.applyEffect(player, targets);
        player.setCasting(false);

        let nbKills = 0;
        let nbHits = 0;
        let oneShot = false;
        targets.forEach(target => {
            if (target.HPHasChanged()) {
                const delta = target.getHPDelta();
                // console.log(`[Game:applyMagic] delta: ${delta}, justDied: ${target.justDied}, targetHP: ${target.getHP()}, targetMaxHP: ${target.getMaxHP()}`);
                player.increaseDamageDealt(delta);
                if (target.justDied){
                    nbKills++;
                }
                if (delta > 0) {
                    player.team!.increaseScoreFromHeal(player);
                    player.team!.incrementHealing(delta);
                } else if (delta < 0) {
                    nbHits++;
                }
                if (delta < 0 && Math.abs(delta) == target.getMaxHP()) {
                    oneShot = true;
                }
            }
            player.addInteractedTarget(target);
        });            
        // Add all targets to the list of interacted targets
        team.increaseScoreFromMultiHits(targets.length);
        team.increaseScoreFromSpell(spell.score);

        const nbFrozen = targets.filter(target => target.hasStatusEffect(StatusEffect.FREEZE)).length;
        // Count how many values of terraiMap are Terrain.FIRE
        const nbBurning = this.terrainManager.getNbBurning();

        if (spell.terrain) {
            const terrainUpdates = this.terrainManager.updateTerrainFromSpell(spell, x, y);
            this.broadcastTerrain(terrainUpdates);

            // If any terrain update is not NONE
            if (terrainUpdates.some(update => update.terrain !== Terrain.NONE)) {
                team.increaseScoreFromTerrain();
            }
        }

        if (spell.status) {
            targets.forEach(target => {
                const success = target.addStatusEffect(spell.status.effect, spell.status.duration, spell.status.chance);
                console.log(`[Game:applyMagic] Status effect ${spell.status.effect} applied to target ${target.num}: ${success}`);
                if (success) {
                    team.increaseScoreFromStatusEffect();
                }
            });
        }

        const nbFrozen_ = targets.filter(target => target.hasStatusEffect(StatusEffect.FREEZE)).length;
        const nbBurning_ = this.terrainManager.getNbBurning();
        
        const isKill = nbKills > 0;
        this.broadcast('localanimation', {
            x,
            y,
            id: spell.id,
            isKill,
        });

        const GENs = [];
        // if (team.killStreak > 1) GENs.push(GEN.KILL_STREAK);
        if (nbFrozen_ > nbFrozen) GENs.push(GEN.FROZEN);
        if (nbBurning_ > nbBurning) GENs.push(GEN.BURNING);
        if (oneShot) GENs.push(GEN.ONE_SHOT);
        if (nbKills > 1) GENs.push(GEN.MULTI_KILL);
        if (nbHits > 1) GENs.push(GEN.MULTI_HIT);
        this.broadcastGEN(GENs); // Broadcast gen after localanimation

        this.broadcast('endcast', {
            team: team.id,
            num: player.num
        });
        
        team.sendScore();

        this.turnSystem.processAction(player, spell.speedClass);
        this.processTurn(isKill ? KILL_CAM_DURATION + KILL_CAM_DELAY : SPELL_DELAY);
    }

    broadcastGEN(GENs: GEN[]) {
        const noRepeatGENs = [GEN.BURNING, GEN.FROZEN];
        // Filter out repeated GENs that are in the GEN history, allow others
        GENs = GENs.filter(gen => !this.GENhistory.has(gen) || !noRepeatGENs.includes(gen) || (noRepeatGENs.includes(gen) && !this.GENhistory.has(gen)));
        // Add the new GENs to the history
        GENs.forEach(gen => this.GENhistory.add(gen));

        // If GEN.MULTI_KILL is in the array, remove GEN.MULTI_HIT if it's present
        if (GENs.includes(GEN.MULTI_KILL) && GENs.includes(GEN.MULTI_HIT)) {
            GENs = GENs.filter(gen => gen !== GEN.MULTI_HIT);
        }
    
        // console.log(`[Game:broadcastGEN] GENs: ${GENs}`);
        this.broadcast('gen', GENs);
    }

    processMagic(
        {x, y, index, targetTeam, target}: 
        {x: number, y: number, index: number, targetTeam: number, target: number}, 
    ) {
        // console.log(`Processing magic for team ${team.id}, player ${num}, spell ${index}, target team ${targetTeam}, target ${target}`);
        const player = this.turnee;
        if (!player.canAct()) {
            console.log('[Game:processMagic] cannot act');
            return;
        }

        if (player.isMuted()) return;

        const spell: Spell | null = player.getSpellAtIndex(index);
        if (!spell) return;
        console.log(`[Game:processMagic] Casting spell [${spell.id}] ${spell.name}`);

        if (spell.cost > player.getMP()) {
            console.log(`[Game:processMagic] Not enough MP, ${spell.cost} > ${player.getMP()}!`);
            return;
        }
        const mp = player.consumeMP(spell.cost);

        let targetPlayer: ServerPlayer | null = null;
        if (spell.target === Target.SINGLE) {
            targetPlayer = this.teams.get(targetTeam)?.getMembers()[target - 1];
            if (!targetPlayer || !targetPlayer.isAlive()) {
                console.log(`[Game:processMagic] Invalid target for SINGLE target type!`);
                return;
            }
            x = targetPlayer.x;
            y = targetPlayer.y;
        }

        if (!spell.isHealingSpell()) player.team.incrementOffensiveActions();
        player.team.incrementSpellCasts();

        this.broadcast('cast', {
            team: player.team.id,
            num: player.num,
            id: spell.id,
            location: {x, y},
        });

        this.emitMPchange(player.team, player.num, mp);
        player.setCasting(true);

        const delay = CAST_DELAY * 1000;
        setTimeout(this.applyMagic.bind(this, spell, player, x, y, player.team, targetPlayer), delay);
        return delay;
    }

    broadcastScoreChange(team: Team) {
        this.broadcast('score', {
            teamId: team.id,
            score: team.score,
        });
    }

    emitScoreChange(team: Team) {
        team.socket?.emit('score', {
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

    computeGameOutcomes(team: Team, otherTeam: Team, winnerTeamId: number): OutcomeData {
        try {
            const isWinner = team.id === winnerTeamId;
            const eloUpdate = 
                this.mode == PlayMode.RANKED || this.mode == PlayMode.RANKED_VS_AI ? 
                this.updateElo(isWinner ? team : otherTeam, isWinner ? otherTeam : team) : 
                {winnerUpdate: 0, loserUpdate: 0};
            const grade = this.computeGrade(team, otherTeam);
            return {
                isWinner,
                rawGrade: grade,
                grade: this.computeLetterGrade(grade),
                gold: this.computeTeamGold(grade, this.mode),
                xp: this.computeTeamXP(team, otherTeam, grade, this.mode),
                elo: isWinner ? eloUpdate.winnerUpdate : eloUpdate.loserUpdate,
                key: (this.mode == PlayMode.PRACTICE || this.mode == PlayMode.TUTORIAL) ? null : team.getChestKey() as ChestColor,
                chests: this.computeChests(team.score, this.mode),
                score: team.score,
                tokens: isWinner ? this.computeStakeRewards() : 0,
            }
        } catch (error) {
            console.error(error);
            return {
                isWinner: false,
                rawGrade: 0,
                grade: 'E',
                gold: 0,
                xp: 0,
                elo: 0,
                key: null,
                chests: [],
                score: 0,
                tokens: 0,
            }
        }
    }

    computeStakeRewards() {
        return this.stake * 2 * (1 - LEGION_CUT);
    }

    computeChests(score: number, mode: PlayMode): GameOutcomeReward[] {
        const chests: GameOutcomeReward[] = [];
        if (mode != PlayMode.PRACTICE && mode != PlayMode.TUTORIAL) this.computeAudienceRewards(score, chests);

        return chests;
    }
    
    computeAudienceRewards(score: number, chests: Array<GameOutcomeReward>): void {
        // console.log(`[Game:computeAudienceRewards] League: ${this.league}, Score: ${score}`);
        const casualRewards = [ChestColor.BRONZE, ChestColor.BRONZE, ChestColor.SILVER];
        const leagueRewards = {
            [League.BRONZE]: [ChestColor.BRONZE, ChestColor.BRONZE, ChestColor.BRONZE],
            [League.SILVER]: [ChestColor.BRONZE, ChestColor.BRONZE, ChestColor.SILVER],
            [League.GOLD]: [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD],
            [League.ZENITH]: [ChestColor.SILVER, ChestColor.GOLD, ChestColor.GOLD],
            [League.APEX]: [ChestColor.GOLD, ChestColor.GOLD, ChestColor.GOLD],
        };

        let rewards = 
            this.mode == PlayMode.RANKED || this.mode == PlayMode.RANKED_VS_AI ?
            leagueRewards[this.league] :
            casualRewards;
        if (!rewards) rewards = casualRewards;
        const numberOfChests = Math.floor(score / 500);
    
        for (let i = 0; i < numberOfChests && i < rewards.length; i++) {
            const chestColor = rewards[i];
            chests.push({color: chestColor, content: getChestContent(chestColor)} as GameOutcomeReward);
        }
    }

    computeGrade(team: Team, otherTeam: Team) {
        const hpFactor = team.getHPLeft() / team.getTotalHP();
        const healingFactor = 1 - ((team.getHealedAmount() / (team.getHealedAmount() + otherTeam.getHealedAmount())) || 0);

        // Adjusting the offensive actions calculation
        const teamOffensiveActions = team.getOffensiveActions();
        const otherTeamOffensiveActions = otherTeam.getOffensiveActions();
        let offenseFactor;
        
        // Check for one-shot victories
        if (teamOffensiveActions === 1) {
            // Maximum score for one-shot victory
            offenseFactor = 1.0;
        } else {
            // Normal calculation when not a one-shot
            if (teamOffensiveActions + otherTeamOffensiveActions === 0) {
                offenseFactor = 0;
            } else {
                offenseFactor = 1 - (teamOffensiveActions / (teamOffensiveActions + otherTeamOffensiveActions));
            }
        }

        const levelFactor = 1 - (team.getTotalLevel() / (team.getTotalLevel() + otherTeam.getTotalLevel()));
        // console.log(`HP: ${hpFactor}, Healing: ${healingFactor}, Offense: ${offenseFactor}, Level: ${levelFactor}`);

        const hpCoefficient = 1.5;
        const healingCoefficient = 1;
        const offenseCoefficient = 1;
        const levelCoefficient = 0.5;
        const totalWeight = hpCoefficient + healingCoefficient + offenseCoefficient + levelCoefficient;

        return (hpFactor * hpCoefficient + healingFactor * healingCoefficient + offenseFactor * offenseCoefficient + levelFactor * levelCoefficient)/totalWeight;
    }

    computeLetterGrade(grade: number) {
        if (grade >= 0.95) return 'S+';
        if (grade >= 0.9) return 'S';
        if (grade >= 0.8) return 'A';
        if (grade >= 0.6) return 'B';
        if (grade >= 0.4) return 'C';
        if (grade >= 0.2) return 'D';
        return 'E';
    }

    updateElo(winningTeam: Team, losingTeam: Team): { winnerUpdate: number, loserUpdate: number } {
        const K_FACTOR = 30;

        const expectedScoreWinner = 1 / (1 + Math.pow(10, (losingTeam.getElo() - winningTeam.getElo()) / 400));
        const expectedScoreLoser = 1 / (1 + Math.pow(10, (winningTeam.getElo() - losingTeam.getElo()) / 400));
    
        // Since it's a match, winner's actual score is 1 and loser's actual score is 0
        const actualScoreWinner = 1;
        const actualScoreLoser = 0;
    
        // Calculate rating updates
        const winnerUpdate = Math.round(K_FACTOR * (actualScoreWinner - expectedScoreWinner));
        const loserUpdate = Math.round(K_FACTOR * (actualScoreLoser - expectedScoreLoser));
    
        // Return the elo update for each team
        return {
          winnerUpdate: winnerUpdate,
          loserUpdate: loserUpdate
        };
      }

    computeTeamGold(grade: number, mode: PlayMode) {
        let gold = AVERAGE_GOLD_REWARD_PER_GAME * (grade + 0.3);
        if (mode == PlayMode.PRACTICE || mode == PlayMode.TUTORIAL) gold *= PRACTICE_GOLD_COEF; 
        if (mode == PlayMode.RANKED || mode == PlayMode.RANKED_VS_AI) gold *= RANKED_GOLD_COEF;
        // Add +- 5% random factor
        gold *= 0.95 + Math.random() * 0.1;
        return Math.round(gold);
    }

    computeLevelDifference(team: Team, otherTeam: Team) {
        const teamLevel = team.getMembers().reduce((sum, player) => sum + player.level, 0);
        const otherTeamLevel = otherTeam.getMembers().reduce((sum, player) => sum + player.level, 0);
        return teamLevel - otherTeamLevel;
    }

    computeTeamXP(team: Team, otherTeam: Team, grade: number, mode: PlayMode) {
        if (team.getTotalInteractedTargets() == 0) return 0;
        let xp = otherTeam.getTotalLevel() * XP_PER_LEVEL * (grade + 0.3);
        // console.log(`Base XP: ${xp}: ${otherTeam.getTotalLevel()} * ${XP_PER_LEVEL} * (${grade} + 0.3)`);
        if (mode == PlayMode.PRACTICE || mode == PlayMode.TUTORIAL) xp *= PRACTICE_XP_COEF;
        if (mode == PlayMode.RANKED || mode == PlayMode.RANKED_VS_AI) xp *= RANKED_XP_COEF;
        if (team.isGame0) xp *= 2;
        // Add +- 5% random factor
        xp *= 0.95 + Math.random() * 0.1;

        return Math.round(xp); // Round to nearest whole number
    }

    async writeOutcomesToDb(team: Team, outcomes: OutcomeData, engagement: any) {
        // console.log(`[Game:writeOutcomesToDb] Writing outcomes to DB for team ${team.id}`);
        try {
            await apiFetch(
                'postGameUpdate',
                '',
                {
                    method: 'POST',
                    body: {
                        uid: team.teamData.playerUID,
                        outcomes,
                        mode: this.mode,
                        engagement,
                    },
                    headers: {
                        'x-api-key': process.env.API_KEY,
                    }
                }
            );
        } catch (error) {
            console.error(error);
        }
    }

    async updateGameInDB(winnerUID: string, results: EndGameDataResults) {
        try {
            await apiFetch(
                'completeGame',
                '',
                {
                    method: 'POST',
                    body: {
                        gameId: this.id,
                        winnerUID,
                        results,
                    },
                }
            );
        } catch (error) {
            console.error(error);
        }
    }

    async incrementStartedGames(team: Team) {
        try {
            await apiFetch(
                'incrementStartedGames',
                '',
                {
                    method: 'POST',
                    body: {
                        uid: team.teamData.playerUID,
                    },
                }
            );
        } catch (error) {
            console.error(error);
        }
    }

    async incrementCompletedGames(team: Team) {
        try {
            await apiFetch(
                'incrementCompletedGames',
                '',
                {
                    method: 'POST',
                    body: {
                        uid: team.teamData.playerUID,
                    },
                }
            );
        } catch (error) {
            console.error(error);
        }
    }


    async saveInventoryToDb(token: string, characterId: string, inventory: number[]) {
        console.log(`[Game:saveInventoryToDb] Saving inventory to DB for character ${characterId}`);
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

    async saveGameAction(playerId: string, action: GameAction, details: any) {
        try {
            await apiFetch(
                'insertGameAction',
                '',
                {
                    method: 'POST',
                    body: {
                        gameId: this.id,
                        playerId,
                        actionType: action,
                        details,
                    },
                }
            );
        } catch (error) {
            console.error(error);
        }
    }

    checkFirstBlood(team) {
        if (!this.firstBlood) {
            this.firstBlood = true;
            this.getOtherTeam(team.id).increaseScoreFromFirstBlood();
        }
    }

    handleTeamKill(victimTeam) {
        this.getOtherTeam(victimTeam.id).incrementKillStreak();
        victimTeam.resetKillStreak();
    }

    abandonGame(socket) {
        const team = this.socketMap.get(socket);
        const otherTeam = this.getOtherTeam(team.id);
        this.endGame(otherTeam.id);
    }

    setStake(stake: number) {
        this.stake = stake;
    } 

    isTutorial() {
        return this.mode === PlayMode.TUTORIAL;
    }

    async saveReplayToDb() {
        try {
            await apiFetch(
                'saveReplay',
                '',
                {
                    method: 'POST',
                    body: {
                        gameId: this.id,
                        messages: this.replayMessages,
                        duration: this.duration,
                        mode: this.mode,
                    },
                    headers: {
                        'x-api-key': process.env.API_KEY,
                    }
                }
            );
        } catch (error) {
            console.error('Failed to save replay:', error);
        }
    }

    protected async getRosterData(token: string, retries = 10, delay = 500): Promise<{characters: CharacterData[]}> {
        return withRetry(async () => {
            const db = admin.firestore();
            const decodedToken = await admin.auth().verifyIdToken(token);
            const uid = decodedToken.uid;
            
            const docSnap = await db.collection("players").doc(uid).get();
            if (!docSnap.exists) {
                throw new Error('Player not found');
            }

            const characters = docSnap.data()?.characters as admin.firestore.DocumentReference[];
            
            // Batch get operation with field mask for optimization
            const characterDocs = await db.getAll(...characters, {
                fieldMask: [
                    'name', 'portrait', 'level', 'class', 'experience', 'xp', 'sp', 'stats',
                    'carrying_capacity', 'carrying_capacity_bonus', 'skill_slots', 'inventory',
                    'equipment', 'equipment_bonuses', 'sp_bonuses', 'skills',
                ],
            });

            const rosterData = characterDocs.map((characterDoc) => ({
                id: characterDoc.id,
                name: characterDoc.get('name'),
                level: characterDoc.get('level'),
                class: characterDoc.get('class'),
                experience: characterDoc.get('experience'),
                portrait: characterDoc.get('portrait'),
                xp: characterDoc.get('xp'),
                sp: characterDoc.get('sp'),
                stats: characterDoc.get('stats'),
                carrying_capacity: characterDoc.get('carrying_capacity'),
                carrying_capacity_bonus: characterDoc.get('carrying_capacity_bonus'),
                skill_slots: characterDoc.get('skill_slots'),
                inventory: characterDoc.get('inventory'),
                equipment: characterDoc.get('equipment'),
                equipment_bonuses: characterDoc.get('equipment_bonuses'),
                sp_bonuses: characterDoc.get('sp_bonuses'),
                skills: characterDoc.get('skills'),
            }));

            return { characters: rosterData };
        }, retries, delay, 'getRosterData');
    }
}

interface Tile {
    x: number;
    y: number;
}

