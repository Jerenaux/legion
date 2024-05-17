import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { CharacterUpdate, ChestData, ChestsData, ChestsKeysData } from '@legion/shared/interfaces';
import { chestTypes } from '@legion/shared/enums';


const MULTIHIT_SCORE_BASE = 6;
const KILL_SCORE_BONUS = 1000;
const HEAL_SCORE_BONUS = 200;
const REVIVE_SCORE_BONUS = 500;
const STATUS_EFFECT_SCORE_BONUS = 100;
const TERRAIN_SCORE_BONUS = 100;
const DOT_SCORE_BONUS = 5;
const FIRST_BLOOD_BONUS = 300;

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
    hpTotal: number = 0;
    levelTotal: number = 0;
    healedAmount: number = 0;
    offensiveActions: number = 0;

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
        this.hpTotal += player.getHP();
        this.levelTotal += player.getLevel();
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

    increaseScoreFromRevive(nb = 1) {
        this.score += nb * REVIVE_SCORE_BONUS;
    }

    increaseScoreFromStatusEffect() {
        this.score += STATUS_EFFECT_SCORE_BONUS;
    }

    increaseScoreFromTerrain() {
        this.score += TERRAIN_SCORE_BONUS;
    }

    increaseScoreFromDot() {
        this.score += DOT_SCORE_BONUS;
    }

    increaseScoreFromFirstBlood() {
        this.score += FIRST_BLOOD_BONUS
    }

    incrementHealing(amount: number) {
        this.healedAmount += amount;
    }

    incrementScore(amount: number) {
        this.score += amount;
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
        for(const key of chestTypes) {
            const chest = chestsData[key] as ChestData;
            if (chest.hasKey) continue;
            if (chest.countdown <= 0) {
                this.chestKeys[key] = true;
                return; // Only one key unlocked per game
            }
        }
    }

    
    getChestsKeys() {
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
        console.log(`Distributing XP: ${xp}`)
        const total = this.getTotalInteractedTargets();
        for (let i = 0; i < this.members.length; i++) {
            const xpRatio = (this.members[i].countInteractedTargets() / total) || 0;
            const xpShare = Math.round(xp * xpRatio);
            console.log(`XP share for ${this.members[i].name}: ${xpShare} (${this.members[i].countInteractedTargets()} / ${total})`);
            this.members[i].gainXP(xpShare);
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

    incrementOffensiveActions() {
        this.offensiveActions++;
    }

    getTotalHP() {
        return this.hpTotal;
    }

    getTotalLevel() {
        return this.levelTotal;
    }

    getHPLeft() {
        let hpLeft = 0;
        for (let i = 0; i < this.members.length; i++) {
            hpLeft += this.members[i].getHP();
        }
        return hpLeft;
    }

    getHealedAmount() {
        return this.healedAmount;
    }

    getOffensiveActions() {
        return this.offensiveActions;
    }

    getTotalInteractedTargets() {
        let total = 0;
        for (let i = 0; i < this.members.length; i++) {
            total += this.members[i].countInteractedTargets();
        }
        return total;
    }

    unsetSocket() {
        this.socket = null;
    }
}