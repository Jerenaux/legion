import { Socket, Server } from 'socket.io';

import { Game } from './Game';
import { ServerPlayer } from './ServerPlayer';
import { AIServerPlayer } from './AIServerPlayer';

export class AIGame extends Game {
    constructor(io: Server, sockets: Socket[]) {
        super(io, sockets);

        this.tickTimer = setInterval(this.AItick.bind(this), 500);
    }

    populateTeams() {
        this.teams.get(1)?.addMember(new ServerPlayer(1, 'warrior_1', 18, 4));
        this.teams.get(1)?.addMember(new ServerPlayer(2, 'mage_1', 18, 2));
        this.teams.get(1)?.addMember(new ServerPlayer(3, 'warrior_2', 18, 6));
        this.teams.get(2)?.addMember(new AIServerPlayer(1, 'warrior_3', 3, 4));
        this.teams.get(2)?.addMember(new AIServerPlayer(2, 'mage_2', 1, 2));
        this.teams.get(2)?.addMember(new AIServerPlayer(3, 'warrior_4', 1, 6));
    }

    AItick() {
        (this.teams.get(2)?.getMembers() as AIServerPlayer[]).forEach(player => {
            player.takeAction();
        }, this);
    }
}