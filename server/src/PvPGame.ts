import { Socket, Server } from 'socket.io';

import { Game } from './Game';

export class PvPGame extends Game {
    constructor(io: Server) {
        super(io);
    }

    async populateTeams() {
       
    }
}