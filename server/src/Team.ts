import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";

const MULTIHIT_SCORE_BASE = 6;
const KILL_SCORE_BONUS = 1000;
const HEAL_SCORE_BONUS = 200;

export class Team {
    id: number;
    members: ServerPlayer[] = [];
    score: number = 0;
    _score: number = 0;
    actions: number = 0;
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

    incrementActions() {
        this.actions++;
    }

    increaseScoreFromDamage(amount: number) {
        this.score += amount;
    }

    increaseScoreFromSpell(amount: number) {
        this.score += amount;
    }

    increaseScoreFromMultiHits(amount: number) {
        if (amount > 1) {
            // Apply an exponential multiplier to the score
            this.score += Math.pow(MULTIHIT_SCORE_BASE, amount);
            // console.log(`Multi hit: ${this.id} score: ${this.score}`);
        }
    }

    increaseScoreFromKill(player: ServerPlayer) {
        this.score += KILL_SCORE_BONUS * (1 + (1 - player.getHPratio()));
    }

    increaseScoreFromHeal(player: ServerPlayer) {
        this.score += HEAL_SCORE_BONUS * (1 + (1 - player.getPreviousHPRatio()));
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

    getSocket() {
        return this.socket;
    }

    getFirebaseToken() {
        // @ts-ignore
        return this.socket?.firebaseToken;
    }
}