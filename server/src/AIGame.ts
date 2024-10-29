import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';
import { AIServerPlayer } from './AIServerPlayer';
import {apiFetch} from './API';
import { Class, PlayMode, League, AIAttackMode } from "@legion/shared/enums";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Team} from "./Team";
import { DBCharacterData, PlayerContextData } from '@legion/shared/interfaces';
import {FREEZE_AI} from "@legion/shared/config";
import { Item } from './Item';
import { getConsumableById } from '@legion/shared/Items';


const TICK = 100;
const AI_VS_AI = false;

export class AIGame extends Game {
    nbExpectedPlayers = 1;
    tickTimer: NodeJS.Timeout | null = null;
    temporaryFrozen = false;
    savedCharacters = {};

    constructor(id: string, mode: PlayMode, league: League, io: Server) {
        super(id, mode, league, io);
        if (mode === PlayMode.TUTORIAL) this.temporaryFrozen = true;
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
            character.stats.hp = 40;
        }
        // Half all the stats of the character
        Object.keys(character.stats).forEach(stat => {
            character.stats[stat] = Math.floor(character.stats[stat] / 2);
        });

        const position = this.findFreeCellNear(data.x, data.y);
        const newCharacter = this.addAICharacter(aiTeam!, character, position);
        newCharacter.setCooldown(3500);
        newCharacter.setAttackMode(data.attackMode);

        this.broadcast('addCharacter', {
            team: aiTeam!.id,
            character: newCharacter.getPlacementData(false),
        });
    }

    addAICharacter(team: Team, character: DBCharacterData, position?: {x: number, y: number}) {
        if (!position) position = this.getPosition(team.getMembers().length, true);
        const newCharacter = new AIServerPlayer(team.getMembers().length + 1, character.name, character.portrait, position.x, position.y);
        newCharacter.setTeam(team);
        newCharacter.setUpCharacter(character);
        team.addMember(newCharacter);
        return newCharacter;
    }

    createAITeam(team: Team, nb: number, levels?: number[]) {
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

        return levels;
    }

    async fetchZombieTeam(team: Team, elo: number, nb: number, levels: number[]) {
        // console.log(`[AIGame:fetchZombieTeam] mode = ${this.mode}, league = ${this.league}, elo = ${elo}`);
        const league = this.mode == PlayMode.RANKED_VS_AI ? this.league : -1;
        const data = await apiFetch(`zombieData?league=${league}&elo=${elo}`, ''); // TODO: Add API key
        console.log(`[AIGame:fetchZombieTeam] Zombie player data: ${JSON.stringify(data.playerData)}`);
        
        if (data.playerData === undefined) {
            console.log('[AIGame:fetchZombieTeam] Failed to fetch zombie data. Falling back to createAITeam.');
            this.createAITeam(team, nb, levels);
        } else {
            team.setPlayerData(data.playerData);
            data.rosterData.characters.forEach((character: DBCharacterData, index: number) => {
                this.addAICharacter(team, character);
            });
        }
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

    async populateTeams() {
        const DEFAULT_SIZE = 3;
        const playerTeam = this.teams.get(1);
        const aiTeam = this.teams.get(2);
        let levels = [];
        let nb = DEFAULT_SIZE;

        if (AI_VS_AI) {
            levels = this.createAITeam(playerTeam!, DEFAULT_SIZE);
        } else {
            // console.log(`[AIGame:populateTeams] Fetching player team data...`);
            const teamData = await apiFetch('rosterData', playerTeam.getFirebaseToken());
            let characters = [];
            teamData.characters.forEach((character: any, index) => {
                const position = this.getPosition(index, false);
                const newCharacter = new ServerPlayer(index + 1, character.name, character.portrait, position.x, position.y);
                newCharacter.setTeam(playerTeam!);
                newCharacter.setUpCharacter(character);
                characters.push(newCharacter);
                levels.push(character.level);
            });
            characters = this.modifyTeamForTutorial(characters);
            characters.forEach(character => {
                playerTeam?.addMember(character);
            });
            nb = teamData.characters.length;
        }

        // console.log(`[AIGame:populateTeams] Game mode is ${this.mode}, isZombie: ${this.mode === PlayMode.CASUAL_VS_AI || this.mode === PlayMode.RANKED_VS_AI}`);
        if (this.mode === PlayMode.CASUAL_VS_AI || this.mode === PlayMode.RANKED_VS_AI) {
            await this.fetchZombieTeam(aiTeam!, playerTeam.teamData.elo, nb, levels);
        } else {
            if (this.mode != PlayMode.TUTORIAL) {
                this.createAITeam(aiTeam!, nb, levels);
            }
        }
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
        this.tickTimer = setInterval(this.AItick.bind(this), TICK);
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

    AItick() {
        if (this.gameOver) {
            clearInterval(this.tickTimer!);
            return;
        }

        const AIteams = AI_VS_AI ? [1, 2] : [2];

        if (FREEZE_AI) return;

        AIteams.forEach(teamNum => {
            (this.teams.get(teamNum)?.getMembers() as AIServerPlayer[]).forEach(player => {
                const delay = player.takeAction();
                setTimeout(() => {
                    this.checkEndGame();
                }, delay);
            }, this);
        });
    }
}