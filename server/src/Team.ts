import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";

export class Team {
    id: number;
    members: ServerPlayer[] = [];
    game: Game;

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
}