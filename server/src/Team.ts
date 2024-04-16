import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { CharacterUpdate, ChestData, ChestsData, ChestsKeysData } from '@legion/shared/interfaces';
import { chestTypes } from '@legion/shared/enums';


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
    elo: number = 0;
    chestKeys: ChestsKeysData;

    constructor(number: number, game: Game) {
        this.id = number;
        this.game = game;
        this.chestKeys = {
            bronze: false,
            silver: false,
            gold: false,
        }
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

    setElo(elo: number) {
        this.elo = elo;
    }

    registerChestsData(chestsData: ChestsData) {
        for(const key in chestTypes) {
            const chest = chestsData[key] as ChestData;
            if (chest.hasKey) continue;
            const timeLeft = chest.time - (Date.now() / 1000);
            if (timeLeft <= 0) {
                this.chestKeys[key] = true;
                return; // Only one key unlocked per game
            }
        }
    }

    getChestsRewards() {
        return this.chestKeys;
    }

    getSocket() {
        return this.socket;
    }

    getFirebaseToken() {
        // @ts-ignore
        return this.socket?.firebaseToken;
    }

    distributeXp(xp: number) {
        for (let i = 0; i < this.members.length; i++) {
            this.members[i].gainXP(xp);
        }
    }

    getCharactersDBUpdates(): CharacterUpdate[] {
        // Map character id to the number of stats points earned
        return this.members.map((member) => ({
            id: member.dbId,
            points: member.earnedStatsPoints,
            xp: member.xp,
            level: member.level
        }));
    }    

    clearAllTimers() {
        for (let i = 0; i < this.members.length; i++) {
            this.members[i].clearAllTimers();
        }
    }
}