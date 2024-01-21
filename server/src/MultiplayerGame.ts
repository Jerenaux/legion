import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';

export class MultiplayerGame extends Game {
    constructor(io: Server, sockets: Socket[]) {
        super(io, sockets);

        this.socketMap.set(sockets[1], this.teams.get(2)!);
        this.teams.get(2)?.setSocket(sockets[1]);
    }

    populateTeams() {
        // this.teams.get(1)?.addMember(new ServerPlayer(1, 'warrior_1', 5, 4));
        // this.teams.get(1)?.addMember(new ServerPlayer(2, 'mage_1', 18, 2));
        // this.teams.get(1)?.addMember(new ServerPlayer(3, 'warrior_2', 18, 6));
        // this.teams.get(2)?.addMember(new ServerPlayer(1, 'warrior_3', 3, 4));
        // this.teams.get(2)?.addMember(new ServerPlayer(2, 'mage_2', 1, 2));
        // this.teams.get(2)?.addMember(new ServerPlayer(3, 'warrior_4', 1, 6));
    }
}