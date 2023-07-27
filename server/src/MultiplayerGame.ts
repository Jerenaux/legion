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
        this.teams.get(1)?.addMember(new ServerPlayer('warrior_1', 5, 4));
        this.teams.get(1)?.addMember(new ServerPlayer('mage_1', 18, 2));
        this.teams.get(1)?.addMember(new ServerPlayer('warrior_2', 18, 6));
        this.teams.get(2)?.addMember(new ServerPlayer('warrior_3', 3, 4));
        this.teams.get(2)?.addMember(new ServerPlayer('mage_2', 1, 2));
        this.teams.get(2)?.addMember(new ServerPlayer('warrior_4', 1, 6));
    }
}