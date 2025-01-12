import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';
import { AIServerPlayer } from './AIServerPlayer';
import {apiFetch} from './API';
import { Class, PlayMode, League, AIAttackMode, Stat } from "@legion/shared/enums";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Team} from "./Team";
import { DBCharacterData, PlayerContextData } from '@legion/shared/interfaces';
import { Item } from './Item';
import { getConsumableById } from '@legion/shared/Items';
import { GAME_0_TURN_DURATION, TURN_DURATION } from '@legion/shared/config';


const AI_VS_AI = false;

export class AIGame extends Game {
    nbExpectedPlayers = 1;
    tickTimer: NodeJS.Timeout | null = null;
    temporaryFrozen = false;
    savedCharacters = {};
    lastAIActionTime: number = 0;

    constructor(id: string, mode: PlayMode, league: League, io: Server) {
        super(id, mode, league, io);
        // if (mode === PlayMode.TUTORIAL) this.temporaryFrozen = true;
    }

    summonAlly(data: {x: number, y: number, className: Class}) {
        console.log('[AIGame:summonAlly] Summoning ally...');
        const team = this.teams.get(1);
        const character = this.savedCharacters[data.className];
        const position = this.findFreeCellNear(data.x, data.y);
        character.setPosition(position.x, position.y);
        character.num = team.getMembers().length + 1;
        team.addMember(character);

        this.broadcast('addCharacter', {
            team: team!.id,
            character: character.getPlacementData(true),
        });
    }

    summonEnemy(data: {x: number, y: number, attackMode: AIAttackMode, className: Class, full: boolean}) {
        if (!data.className) data.className = Class.WARRIOR;
        const aiTeam = this.teams.get(2);
        const character = new NewCharacter(data.className, 1, false, true).getCharacterData();
        if (!data.full) {
            character.portrait = 'mil1_3';
            character.stats[Stat.HP] = 40;
        }
        // Half all the stats of the character
        Object.keys(character.stats).forEach(stat => {
            character.stats[stat] = Math.floor(character.stats[stat] / 2);
        });

        const position = this.findFreeCellNear(data.x, data.y);
        const newCharacter = this.addAICharacter(aiTeam!, character, position);
        newCharacter.setAttackMode(data.attackMode);
        this.turnSystem.addCharacter(newCharacter);

        this.broadcast('addCharacter', {
            team: aiTeam!.id,
            character: newCharacter.getPlacementData(false),
        });
        this.broadcastQueueData();
    }

    addAICharacter(team: Team, character: DBCharacterData, position?: {x: number, y: number}) {
        if (!position) position = this.getPosition(team.getMembers().length, true);
        const newCharacter = new AIServerPlayer(team.getMembers().length + 1, character.name, character.portrait, position.x, position.y);
        newCharacter.setTeam(team);
        newCharacter.setUpCharacter(character, true);
        team.addMember(newCharacter);
        return newCharacter;
    }

    createAITeam(team: Team, nb: number = 3, levels?: number[]) {
        console.log(`[AIGame:createAITeam] Creating AI team with ${nb} members...`);
        const classes = [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE];
        if (!levels) {
            // Populate levels array with as many random values between 1 and 10 as needed
            levels = [];
            for (let i = 0; i < nb; i++) {
                levels.push(Math.floor(Math.random() * 10) + 1);
            }
        }

        for (let i = 0; i < nb; i++) {
            const character = new NewCharacter(classes[i], levels[i], false, true).getCharacterData();
            this.addAICharacter(team, character);
        }

        if (this.mode === PlayMode.TUTORIAL) {
            team.teamData.playerName = 'Taskmaster';
        }
    }

    async fetchZombieData(elo: number) {
        try {
            const league = this.mode == PlayMode.RANKED_VS_AI ? this.league : -1;
            const data = await apiFetch(
                `zombieData?league=${league}&elo=${elo}`,
                '',
                {
                    headers: {
                        'x-api-key': process.env.API_KEY,
                    }
                }
            );
            // console.log(`[AIGame:fetchZombieData] All zombie data: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
            console.error('[AIGame:fetchZombieData] Error fetching zombie data:', error);
            return {};
        }
    }

    async createZombieTeam(team: Team, zombieData) {
        team.setPlayerData(zombieData.playerData);
        zombieData.rosterData.characters.forEach((character: DBCharacterData, index: number) => {
            this.addAICharacter(team, character).setZombie(true);
        });
    }

    modifyTeamForTutorial(characters: ServerPlayer[]) {
        if (this.mode == PlayMode.TUTORIAL) {
            // Save all characters in a map for later use, mapping class to character
            characters.forEach(character => {
                this.savedCharacters[character.class] = character;
            });
            this.savedCharacters[Class.WARRIOR].addItem(new Item(getConsumableById(0)));
            this.savedCharacters[Class.BLACK_MAGE].addItem(new Item(getConsumableById(1)));
            this.savedCharacters[Class.WHITE_MAGE].addItem(new Item(getConsumableById(0))); 
            characters = [this.savedCharacters[Class.WARRIOR]];
            characters[0].y += 1;
        }
        return characters;
    }

    async createPlayerTeam(playerTeam: Team) {
        const teamData = await apiFetch('rosterData', playerTeam.getFirebaseToken());
        let characters = [];
        teamData.characters.forEach((character: any, index) => {
            const position = this.getPosition(index, false);
            const newCharacter = new ServerPlayer(index + 1, character.name, character.portrait, position.x, position.y);
            newCharacter.setTeam(playerTeam!);
            newCharacter.setUpCharacter(character, false);
            characters.push(newCharacter);
        });
        characters = this.modifyTeamForTutorial(characters);
        characters.forEach(character => {
            playerTeam?.addMember(character);
        });
    }

    async populateTeams() {
        const playerTeam = this.teams.get(1);
        const aiTeam = this.teams.get(2);

        this.turnDuration = Math.max(
            GAME_0_TURN_DURATION - (playerTeam.getPlayerData().completedGames * 20),
            TURN_DURATION
        );

        if (AI_VS_AI) {
            this.createAITeam(playerTeam!);
        } else {
            await this.createPlayerTeam(playerTeam);
        }

        const nb = playerTeam.getMembers().length;
        const levels = playerTeam.getMembers().map(player => player.level);
        let isVsZombie = false;
        if (this.mode === PlayMode.CASUAL_VS_AI || this.mode === PlayMode.RANKED_VS_AI) {
            const zombieData = await this.fetchZombieData(playerTeam.teamData.elo);
            console.log(`[AIGame:populateTeams] Fetched zombie data: ${JSON.stringify(zombieData)}`);
            // Check if the zombieData is not empty
            if (Object.keys(zombieData).length > 0 && zombieData?.playerData && zombieData?.rosterData) {
                await this.createZombieTeam(aiTeam!, zombieData);
                isVsZombie = true;
            } else {
                console.log('[AIGame:populateTeams] Failed to fetch zombie data. Falling back to createAITeam.');
                this.createAITeam(aiTeam!, nb, levels);
            }
        } else { // Create a matching team for practice
            if (this.mode != PlayMode.TUTORIAL) {
                this.createAITeam(aiTeam!, nb, levels);
            }
        }

        const AImodes = [
            PlayMode.PRACTICE, PlayMode.CASUAL_VS_AI, PlayMode.RANKED_VS_AI, PlayMode.TUTORIAL
        ];
        if (AImodes.includes(this.mode)) {
            let winRatio = playerTeam.teamData.AIwinRatio;
            if (this.mode === PlayMode.RANKED_VS_AI) winRatio += 0.1 + (this.league * 0.1);
        
            aiTeam.addWinRatio(winRatio);
            console.log(`[AIGame:populateTeams] AI team win ratio: ${winRatio}`);

            if (winRatio <= 0.1) aiTeam.scaleStats(0.5);
            if (winRatio <= 0.3) {
                aiTeam.disableItems();
                aiTeam.banSpells([3,4,5,6,7,8]);
                aiTeam.disableStatusEffects();
            }
            if (winRatio <= 0.5) aiTeam.setHealRandomThreshold(0.4);
            if (winRatio <= 0.6) aiTeam.banSpells([6,7,8]);
            if (winRatio > 0.9) {
                if (!isVsZombie || (this.mode === PlayMode.RANKED_VS_AI && this.league >= League.GOLD)) this.addExtraTeamMember(aiTeam!);
                aiTeam.scaleStats(1.2);
            }

            if (isVsZombie && winRatio >= 0.5) {
                const averageLevel = Math.ceil(aiTeam.getMembers().reduce((sum, player) => sum + player.level, 0) / aiTeam.getMembers().length);
                aiTeam.zombieLevelUp(averageLevel);
                aiTeam.setZombieInventories();
                aiTeam.setZombieSpells();
            }
        }
    }

    addExtraTeamMember(team: Team) {
        // Get average level of the team
        const averageLevel = Math.ceil(team.getMembers().reduce((sum, player) => sum + player.level, 0) / team.getMembers().length);
        const character = new NewCharacter(Class.RANDOM, averageLevel, false, true).getCharacterData();
        this.addAICharacter(team, character);
    }

    async addPlayer(socket: Socket, playerData: PlayerContextData) {
        super.addPlayer(socket, playerData);
        if (this.sockets.length === this.nbExpectedPlayers) {
            this.start();
        } else {
            console.log(`Waiting for ${this.nbExpectedPlayers - this.sockets.length} more player(s) to join...`);
        }
    }

    putInFormation() {
        console.log('[AIGame:putInFormation] Putting in formation...');
        // Iterate over the player team and set their formation to the default one
        this.teams.get(1)?.getMembers().forEach(player => {
            const newPosition = this.getPosition(player.num - 1, false);
            this.updatePlayerPosition(player, newPosition.x, newPosition.y);
            this.broadcastMove(this.teams.get(1)!, player.num, newPosition);
        });
        // iterate over the enemy team and set their attack mode to UNLIMITED
        this.teams.get(2)?.getMembers().forEach(player => {
            (player as AIServerPlayer).setAttackMode(AIAttackMode.UNLIMITED);
        });
        // Summon 3 enemies in the mirror positions, one of each class
        [Class.WARRIOR, Class.WHITE_MAGE, Class.BLACK_MAGE].forEach((className, index) => {
            const newPosition = this.getPosition(index, true);
            this.summonEnemy({x: newPosition.x, y: newPosition.y, attackMode: AIAttackMode.UNLIMITED, className, full: true});
        });
    }

    async start() {
        if (this.teams.size < this.nbExpectedPlayers) return;
        super.start();
    }

    endGame(winner: number) {
        clearInterval(this.tickTimer!);
        super.endGame(winner);
    }

    endTutorial() {
        console.log('[AIGame:endTutorial] Ending tutorial...');
        this.temporaryFrozen = false;
        this.tutorialSettings.allowVictoryConditions = true;
    }

    processTutorialEvent(data: any) {
        switch (data.action) {
            case 'summonEnemy':
                this.summonEnemy(data);
                break;
            case 'summonAlly':
                this.summonAlly(data);
                break;
            case 'putInFormation':
                this.putInFormation();
                break;
            case 'slowDownCooldowns':
                this.tutorialSettings.shortCooldowns = false;
                break;
        }
    }
}