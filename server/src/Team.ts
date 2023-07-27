import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";

export class Team {
    id: number;
    members: ServerPlayer[] = [];
    game: Game;
    socket: Socket | null = null;

    constructor(number: number, game: Game) {
        this.id = number;
        this.game = game;
    }   

    addMember(player: ServerPlayer) {
        this.members.push(player);
        player.setTeam(this);
    }

    getMembers(): ServerPlayer[] {
        return this.members;
    }

    setSocket(socket: Socket) {
        this.socket = socket;
    }
}