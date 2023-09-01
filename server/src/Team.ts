import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";

export class Team {
    id: number;
    members: ServerPlayer[] = [];
    score: number = 0;
    _score: number = 0;
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

    getMember(index: number): ServerPlayer {
        return this.members[index];
    }

    isDefeated() {
        for (let i = 0; i < this.members.length; i++) {
            if (this.members[i].isAlive()) return false;
        }
        return true;
    }

    increaseScoreFromDamage(amount: number) {
        this.score -= amount;
        console.log(`Team ${this.id} score: ${this.score}`);
    }

    increaseScoreFromSpell(amount: number) {
        this.score += amount;
    }

    increaseScoreFromMultiHits(amount: number) {
        if (amount > 1) {
            // Apply an exponential multiplier to the score
            this.score += Math.pow(6, amount);
            console.log(`Multi hit: ${this.id} score: ${this.score}`);
        }
    }

    increaseScoreFromKill(player: ServerPlayer) {
        this.score += 1000 * (1 + (1 - player.getHPratio()));
    }

    increaseScoreFromHeal(player: ServerPlayer) {
        this.score += 200 * (1 + (1 - player.getPreviousHPRatio()));
    }

    snapshotScore() {
        this._score = this.score;
    }

    sendScore() {
        if (this.score != this._score) {
            this.game.broadcastScoreChange(this);
        }
    }

    setSocket(socket: Socket) {
        this.socket = socket;
    }
}