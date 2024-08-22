import { Socket, Server } from 'socket.io';

import { ServerPlayer } from './ServerPlayer';
import { Team } from './Team';
import { Spell } from './Spell';
import { lineOfSight, listCellsOnTheWay } from '@legion/shared/utils';
import {apiFetch} from './API';
import { Terrain, PlayMode, Target, StatusEffect, ChestColor, League, GEN } from '@legion/shared/enums';
import { OutcomeData, TerrainUpdate, APIPlayerData, GameOutcomeReward, GameData, EndGameDataResults } from '@legion/shared/interfaces';
import { getChestContent } from '@legion/shared/chests';
import { AVERAGE_GOLD_REWARD_PER_GAME, XP_PER_LEVEL } from '@legion/shared/config';
import { TerrainManager } from './TerrainManager';

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
    league: League;
    teams: Map<number, Team> = new Map<number, Team>();
    gridMap: Map<string, ServerPlayer> = new Map<string, ServerPlayer>();
    terrainManager = new TerrainManager(this);
    io: Server;
    sockets: Socket[] = [];
    socketMap = new Map<Socket, Team>();
    startTime: number = Date.now();
    duration: number = 0;
    gameStarted: boolean = false;
    firstBlood: boolean = false;
    gameOver: boolean = false;
    audienceTimer: NodeJS.Timeout | null = null;
    checkEndTimer: NodeJS.Timeout | null = null;

    gridWidth: number = 20;
    gridHeight: number = 10;

    constructor(id: string, mode: PlayMode, league: League, io: Server) {
        this.id = id;
        this.mode = mode;
        this.league = league;
        this.io = io;

        this.teams.set(1, new Team(1, this));
        this.teams.set(2, new Team(2, this));
        console.log(`[Game] Created game ${this.id}`);
    }

    addSocket(socket: Socket) {
        this.sockets.push(socket);
        socket.join(this.id);
    }

    addPlayer(socket: Socket, playerData: APIPlayerData) {
        try {
            if (this.sockets.length === 2) return;
            this.addSocket(socket);
            const index = this.sockets.indexOf(socket);
            console.log(`[Game:addPlayer] Adding player ${index + 1} to game ${this.id}`);

            const team = this.teams.get(index + 1);
            console.log(`[Game:addPlayer] Player ${playerData.name} assigned to team ${team.id}`);
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
        // if (!this.gameOver) {
        //     this.endGame(this.getOtherTeam(disconnectingTeam.id).id);
        // }
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
            await this.populateTeams();
            this.populateGrid();
            this.startGame();
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
        return this.terrainManager.terrainMap.get(`${gridX},${gridY}`) === Terrain.ICE;
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

    startGame() {
        console.log(`[Game:startGame]`)
        this.startTime = Date.now();
        this.gameStarted = true;
        this.sockets.forEach(socket => this.sendGameStatus(socket));
        
        this.audienceTimer = setInterval(() => {
            this.teams.forEach(team => {
                team.incrementScore(10);
                team!.sendScore();
            });
        }, 30 * 1000);

        this.checkEndTimer = setInterval(() => {
            this.checkEndGame();
        }, 1000);
    }

    sendGameStatus(socket: Socket, reconnect: boolean = false) {
        if (reconnect) {
            console.log(`[Game:sendGameStatus] Reconnect`);
        }
        if (reconnect && !this.gameStarted) {
            console.error(`[Game:sendGameStatus] Reconnect flag set to true for game not started`);
        }
        const teamId = this.socketMap.get(socket)?.id!;
        socket.emit('gameStatus', this.getGameData(teamId, reconnect));
    }

    broadcast(event: string, data: any) {
        this.io.in(this.id).emit(event, data);
    }

    getGameData(playerTeamId: number, reconnect: boolean = false): GameData {
        const otherTeamId = this.getOtherTeam(playerTeamId).id;
        const team = this.teams.get(playerTeamId);
        const otherTeam = this.teams.get(otherTeamId);
        const data = {
            general: {
                reconnect,
                tutorial: false,
                spectator: false,
                mode: this.mode,
            },
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

        let team: Team;
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
                this.saveGameAction(team.teamData.playerUID, GameAction.MOVE, data);
                break;
            case 'attack':
                this.processAttack(data, team!);
                this.saveGameAction(team.teamData.playerUID, GameAction.ATTACK, data);
                break;
            case 'obstacleattack':
                this.processObstacleAttack(data, team!);
                break;
            case 'useitem':
                this.processUseItem(data, team!);
                this.saveGameAction(team.teamData.playerUID, GameAction.ITEM_USE, data);
                break;
            case 'spell':
                this.processMagic(data, team!);
                this.saveGameAction(team.teamData.playerUID, GameAction.SPELL_USE, data);
                break;
        }
    }

    checkEndGame() {
        if (this.gameOver) return;
        if (this.teams.get(1)!.isDefeated() || this.teams.get(2)!.isDefeated()) {
            this.endGame(this.teams.get(1).isDefeated() ? 2 : 1);
        }
    }

    endGame(winnerTeamID: number) {
        this.duration = Date.now() - this.startTime;
        this.gameOver = true;

        clearTimeout(this.audienceTimer!);
        clearTimeout(this.checkEndTimer!);
        this.teams.forEach(team => {
            team.clearAllTimers();
        }, this);

        const results = {};
        let winnerUID;
        this.sockets.forEach(socket => {
            const team = this.socketMap.get(socket);
            const otherTeam = this.getOtherTeam(team!.id);
            const outcomes = this.computeGameOutcomes(team, otherTeam, winnerTeamID) as OutcomeData;
            team.distributeXp(outcomes.xp);
            outcomes.characters = team.getCharactersDBUpdates();
            this.writeOutcomesToDb(team, outcomes);
            console.log(`[Game:endGame] Team ${team!.id} outcomes: ${JSON.stringify(outcomes)}`);
            socket.emit('gameEnd', outcomes);

            results[team.teamData.playerUID] = {
                audience: team.score,
                score: outcomes.rawGrade,
            }
            if (team.id === winnerTeamID) {
                winnerUID = team.teamData.playerUID;
            }
        });
        this.updateGameInDB(winnerUID, results);
    }

    setCooldown(player: ServerPlayer, cooldown: number) {
        player.setCooldown(cooldown);
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

        player.stopTerrainDoT();
        
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
            cooldown: player.cooldown,
        });

        return 0;
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
        
        const cooldown = player.getCooldown('attack');
        this.setCooldown(player, cooldown);

        this.broadcast('attack', {
            team: team.id,
            target,
            num,
            damage: -damage,
            hp: opponent.getHP(),
            isKill: opponent.justDied,
        });

        if (oneShot) { // Broadcast gen after attack
            this.broadcast('gen', {
                gen: GEN.ONE_SHOT
            });
        }

        team.socket?.emit('cooldown', {
            num,
            cooldown: player.cooldown,
        });

        return 0;
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

        const terrainUpdates = this.terrainManager.removeIce(x, y);
        this.broadcastTerrain(terrainUpdates);

        this.broadcast('obstacleattack', {
            team: team.id,
            num,
            x, y,
        });

        team.socket?.emit('cooldown', {
            num,
            cooldown: player.cooldown,
        });

        return 0;
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

        // Add all targets to the list of interacted targets
        targets.forEach(target => player.addInteractedTarget(target));

        const deadTargets_ = targets.filter(target => !target.isAlive()).length;
        item.applyEffect(targets);
        const deadTargets = targets.filter(target => !target.isAlive()).length;

        if (deadTargets < deadTargets_) {
            player.team!.increaseScoreFromRevive(deadTargets_ - deadTargets);
        }

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
            cooldown: player.cooldown,
        });

        team.socket?.emit('inventory', {
            num,
            inventory: player.getNetworkInventory(),
        });

        return 0;
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
                console.log(`[Game:applyMagic] delta: ${delta}, justDied: ${target.justDied}, targetHP: ${target.getHP()}, targetMaxHP: ${target.getMaxHP()}`);
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

        this.setCooldown(player, spell.cooldown * 1000);
        
        this.broadcast('localanimation', {
            x,
            y,
            id: spell.id,
            isKill: nbKills > 0,
        });

        const GENs = [];
        // if (team.killStreak > 1) GENs.push(GEN.KILL_STREAK);
        if (nbFrozen_ > nbFrozen) GENs.push(GEN.FROZEN);
        if (nbBurning_ > nbBurning) GENs.push(GEN.BURNING);
        if (oneShot) GENs.push(GEN.ONE_SHOT);
        if (nbKills > 1) GENs.push(GEN.MULTI_KILL);
        if (nbHits > 1) GENs.push(GEN.MULTI_HIT);
        this.broadcastGEN(GENs); // Broadcast gen after localanimation

        team.socket?.emit('cooldown', {
            num: player.num,
            cooldown: player.cooldown,
        });

        this.broadcast('endcast', {
            team: team.id,
            num: player.num
        });
        
        team.sendScore();
    }

    broadcastGEN(GENs: GEN[]) {
        /**
         * Broadcast a single GEN among those in the array, based on the following priority order:
         * 1. MULTI_KILL
         * 2. ONE_SHOT
         * 3. MULTI_HIT
         * 4. FROZEN
         */
        if (GENs.includes(GEN.MULTI_KILL)) {
            this.broadcast('gen', {
                gen: GEN.MULTI_KILL
            });
        } else if (GENs.includes(GEN.ONE_SHOT)) {
            this.broadcast('gen', {
                gen: GEN.ONE_SHOT
            });
        } else if (GENs.includes(GEN.MULTI_HIT)) {
            this.broadcast('gen', {
                gen: GEN.MULTI_HIT
            });
        } else if (GENs.includes(GEN.KILL_STREAK)) {
            this.broadcast('gen', {
                gen: GEN.KILL_STREAK
            });
        } else if (GENs.includes(GEN.FROZEN)) {
            this.broadcast('gen', {
                gen: GEN.FROZEN
            });
        } else if (GENs.includes(GEN.BURNING)) {
            this.broadcast('gen', {
                gen: GEN.BURNING
            });
        }
    }

    processMagic({num, x, y, index, targetTeam, target}: {num: number, x: number, y: number, index: number, targetTeam: number, target: number}, team: Team ) {
        // console.log(`Processing magic for team ${team.id}, player ${num}, spell ${index}, target team ${targetTeam}, target ${target}`);
        const player = team.getMembers()[num - 1];
        if (!player.canAct()) {
            console.log('[Game:processMagic] cannot act');
            return;
        }

        if (player.isMuted()) return;

        const spell: Spell | null = player.getSpellAtIndex(index);
        if (!spell) return;
        console.log(`[Game:processMagic] Casting spell [${spell.id}] ${spell.name}`);

        if (spell.cost > player.getMP()) {
            console.log(`[Game:processMagic] Not enough MP!`);
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
            team: team.id,
            num,
            id: spell.id,
            location: {x, y},
        });

        this.emitMPchange(team, num, mp);
        player.setCasting(true);

        const delay = spell.castTime * 1000;
        setTimeout(this.applyMagic.bind(this, spell, player, x, y, team, targetPlayer), delay);
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
        const isWinner = team.id === winnerTeamId;
        const eloUpdate = this.mode == PlayMode.RANKED ? this.updateElo(isWinner ? team : otherTeam, isWinner ? otherTeam : team) : {winnerUpdate: 0, loserUpdate: 0};
        const grade = this.computeGrade(team, otherTeam);
        console.log(`Game grade for team ${team.id}: ${grade}, ${this.computeLetterGrade(grade)}`);
        return {
            isWinner,
            rawGrade: grade,
            grade: this.computeLetterGrade(grade),
            gold: this.computeTeamGold(grade, this.mode),
            xp: this.computeTeamXP(team, otherTeam, grade, this.mode),
            elo: isWinner ? eloUpdate.winnerUpdate : eloUpdate.loserUpdate,
            key: this.mode == PlayMode.PRACTICE ? null : team.getChestKey() as ChestColor,
            chests: this.computeChests(team.score, this.mode),
            score: team.score,
        }
    }

    computeChests(score: number, mode: PlayMode): GameOutcomeReward[] {
        const chests: GameOutcomeReward[] = [];
        if (mode != PlayMode.PRACTICE) this.computeAudienceRewards(score, chests);
        return chests;
    }
    
    computeAudienceRewards(score: number, chests: Array<GameOutcomeReward>): void {
        console.log(`[Game:computeAudienceRewards] League: ${this.league}, Score: ${score}`);
        const leagueRewards = {
            [League.BRONZE]: [ChestColor.BRONZE, ChestColor.BRONZE, ChestColor.BRONZE],
            [League.SILVER]: [ChestColor.BRONZE, ChestColor.BRONZE, ChestColor.SILVER],
            [League.GOLD]: [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD],
            [League.ZENITH]: [ChestColor.SILVER, ChestColor.GOLD, ChestColor.GOLD],
            [League.APEX]: [ChestColor.GOLD, ChestColor.GOLD, ChestColor.GOLD],
        };

        const rewards = leagueRewards[this.league];
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
        console.log(`HP: ${hpFactor}, Healing: ${healingFactor}, Offense: ${offenseFactor}, Level: ${levelFactor}`);

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
        if (mode == PlayMode.PRACTICE) gold *= 0.1; // TODO: make 0
        if (mode == PlayMode.RANKED) gold *= 1.5;
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
        console.log(`Base XP: ${xp}: ${otherTeam.getTotalLevel()} * ${XP_PER_LEVEL} * (${grade} + 0.3)`);
        if (mode == PlayMode.PRACTICE) xp *= 0.1;
        if (mode == PlayMode.RANKED) xp *= 1.2;
        // Add +- 5% random factor
        xp *= 0.95 + Math.random() * 0.1;

        return Math.round(xp); // Round to nearest whole number
    }

    async writeOutcomesToDb(team: Team, rewards: OutcomeData) {
        try {
            await apiFetch(
                'postGameUpdate',
                team.getFirebaseToken(),
                {
                    method: 'POST',
                    body: {
                        outcomes: {
                            isWinner: rewards.isWinner,
                            gold: rewards.gold,
                            xp: rewards.xp,
                            elo: rewards.elo,
                            characters: rewards.characters,
                            key: rewards.key,
                            chests: rewards.chests,
                            score: rewards.score,
                            rawGrade: rewards.rawGrade,
                        } as OutcomeData,
                        mode: this.mode,
                        spellsUsed: team.anySpellsUsed()
                    },
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

    async saveInventoryToDb(token: string, characterId: string, inventory: number[]) {
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
}

interface Tile {
    x: number;
    y: number;
}

