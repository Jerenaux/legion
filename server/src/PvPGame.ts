import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import {apiFetch} from './API';
import { ServerPlayer } from './ServerPlayer';

export class PvPGame extends Game {
    constructor(io: Server) {
        super(io);
    }

    async populateTeams() {
       this.teams.forEach(async (team) => {
        const teamData = await apiFetch('rosterData', team.getFirebaseToken());
            teamData.characters.forEach((character: any, index) => {
                const position = this.getPosition(index, team.id == 1);
                const newPlayer = new ServerPlayer(index + 1, character.name, character.portrait, position.x, position.y);
                newPlayer.setTeam(team!);
                newPlayer.setUpCharacter(character);
                team?.addMember(newPlayer);
            });
       });
    }

    async addPlayer(socket: Socket) {
        super.addPlayer(socket);
        if (this.sockets.length === 2) {
            this.start();
        }
    }
}