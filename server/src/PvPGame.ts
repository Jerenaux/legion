import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import {apiFetch} from './API';
import { ServerPlayer } from './ServerPlayer';
import { PlayMode, League } from "@legion/shared/enums";
import { APIPlayerData } from '@legion/shared/interfaces';


export class PvPGame extends Game {
    nbExpectedPlayers = 2;

    constructor(id: string, mode: PlayMode, league: League, io: Server) {
        super(id, mode, league, io);
    }

    async populateTeams() {
        await Promise.all(Array.from(this.teams.values()).map(async (team) => {
            const teamData = await apiFetch('rosterData', team.getFirebaseToken());
            console.log(`[PvPGame:populateTeams] Team index: ${team.id}`)
            teamData.characters.forEach((character: any, index) => {
                const position = this.getPosition(index, team.id == 2);
                const newPlayer = new ServerPlayer(index + 1, character.name, character.portrait, position.x, position.y);
                newPlayer.setTeam(team);
                newPlayer.setUpCharacter(character);
                team.addMember(newPlayer);
            });
        }));
    }
        

    async addPlayer(socket: Socket, playerData: APIPlayerData) {
        super.addPlayer(socket, playerData);
        if (this.sockets.length === this.nbExpectedPlayers) {
            this.start();
        }
    }

    async start() {
        if (this.teams.size !== this.nbExpectedPlayers) return;
        super.start();
    }
}