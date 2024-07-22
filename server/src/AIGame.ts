import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';
import { AIServerPlayer } from './AIServerPlayer';
import {apiFetch} from './API';
import { Class, PlayMode, League } from "@legion/shared/enums";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Team} from "./Team";
import { APIPlayerData } from '@legion/shared/interfaces';
import {FREEZE_AI} from "@legion/shared/config";


const TICK = 100;
const AI_VS_AI = false;

export class AIGame extends Game {
    nbExpectedPlayers = 1;
    tickTimer: NodeJS.Timeout | null = null;


    constructor(id: string, mode: PlayMode, league: League, io: Server) {
        super(id, mode, league, io);
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
            const position = this.getPosition(i, true);
            const newPlayer = new AIServerPlayer(i + 1, character.name, character.portrait, position.x, position.y)
            newPlayer.setTeam(team!);
            newPlayer.setUpCharacter(character, true);
            team?.addMember(newPlayer);
        }

        return levels;
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
            const teamData = await apiFetch('rosterData', playerTeam.getFirebaseToken());
            teamData.characters.forEach((character: any, index) => {
                const position = this.getPosition(index, false);
                const newPlayer = new ServerPlayer(index + 1, character.name, character.portrait, position.x, position.y);
                newPlayer.setTeam(playerTeam!);
                newPlayer.setUpCharacter(character);
                playerTeam?.addMember(newPlayer);
                levels.push(character.level);
            });
            nb = teamData.characters.length;
        }

        this.createAITeam(aiTeam!, nb, levels);
    }

    async addPlayer(socket: Socket, playerData: APIPlayerData) {
        super.addPlayer(socket, playerData);
        if (this.sockets.length === this.nbExpectedPlayers) {
            this.start();
        } else {
            console.log(`Waiting for ${this.nbExpectedPlayers - this.sockets.length} more player(s) to join...`);
        }
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

    AItick() {
        if (this.gameOver) {
            clearInterval(this.tickTimer!);
            return;
        }

        const AIteams = AI_VS_AI ? [1, 2] : [2];

        AIteams.forEach(teamNum => {
            (this.teams.get(teamNum)?.getMembers() as AIServerPlayer[]).forEach(player => {
                if (!FREEZE_AI){
                    const delay = player.takeAction();
                    setTimeout(() => {
                        this.checkEndGame();
                    }, delay);
                }
            }, this);
        });
    }
}