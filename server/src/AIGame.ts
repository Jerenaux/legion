import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';
import { AIServerPlayer } from './AIServerPlayer';
import {apiFetch} from './API';
import { Stat } from "@legion/shared/types";
import {NewCharacter} from "@legion/shared/NewCharacter";
import {Team} from "./Team";

const TICK = 100;
const AI_VS_AI = false;
const FREEZE = true;

export class AIGame extends Game {
    constructor(io: Server, sockets: Socket[]) {
        super(io, sockets);

        this.tickTimer = setInterval(this.AItick.bind(this), TICK);
    }

    createAITeam(team: Team) {
        for (let i = 0; i < 3; i++) {
            const character = new NewCharacter().generateCharacterData();
            const position = this.getPosition(i, true);
            const newPlayer = new AIServerPlayer(i + 1, character.name, character.portrait, position.x, position.y)
            newPlayer.setTeam(team!);
            newPlayer.setHP(character.hp);
            newPlayer.setMP(character.mp);
            newPlayer.setStat(Stat.ATK, character.atk);
            newPlayer.setStat(Stat.DEF, character.def);
            newPlayer.setStat(Stat.SPATK, character.spatk);
            newPlayer.setStat(Stat.SPDEF, character.spdef);
            newPlayer.setInventory(character.carrying_capacity, character.inventory);
            newPlayer.setSpells(character.skill_slots, character.skills);
            team?.addMember(newPlayer);
        }
    }

    async populateTeams() {
        const playerTeam = this.teams.get(1);
        const aiTeam = this.teams.get(2);

        if (AI_VS_AI) {
            this.createAITeam(playerTeam!);
        } else {
            const teamData = await apiFetch('rosterData', playerTeam.getFirebaseToken());
            teamData.characters.forEach((character: any, index) => {
                const position = this.getPosition(index, false);
                const newPlayer = new ServerPlayer(index + 1, character.name, character.portrait, position.x, position.y);
                newPlayer.setTeam(playerTeam!);
                newPlayer.setHP(character.hp);
                newPlayer.setMP(character.mp);
                newPlayer.setStat(Stat.ATK, character.atk);
                newPlayer.setStat(Stat.DEF, character.def);
                newPlayer.setStat(Stat.SPATK, character.spatk);
                newPlayer.setStat(Stat.SPDEF, character.spdef);
                newPlayer.setInventory(character.carrying_capacity, character.inventory);
                newPlayer.setSpells(character.skill_slots, character.skills);
                playerTeam?.addMember(newPlayer);
            });
        }

        this.createAITeam(aiTeam!);
    }

    getPosition(index, flip) {
        const positions = [
            {x: 16, y: 3},
            {x: 16, y: 5},
            {x: 18, y: 4},
            {x: 18, y: 2},
            {x: 18, y: 6},
        ]
        const position = positions[index];
        if (flip) {
            position.x = 19 - position.x;
        }
        return position;
    }

    AItick() {
        if (this.gameOver) {
            clearInterval(this.tickTimer!);
            return;
        }

        const AIteams = AI_VS_AI ? [1, 2] : [2];

        AIteams.forEach(teamNum => {
            (this.teams.get(teamNum)?.getMembers() as AIServerPlayer[]).forEach(player => {
                if (!FREEZE) player.takeAction();
            }, this);
        });
    }
}