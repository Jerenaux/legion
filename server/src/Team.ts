import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { CharacterUpdate, APIPlayerData, TeamData } from '@legion/shared/interfaces';
import { ChestColor } from '@legion/shared/enums';
import { MAX_AUDIENCE_SCORE } from "@legion/shared/config";


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
    hpTotal: number = 0;
    levelTotal: number = 0;
    healedAmount: number = 0;
    offensiveActions: number = 0;
    spellCasts: number = 0;
    killStreak: number = 0;
    teamData: TeamData;

    constructor(number: number, game: Game) {
        this.id = number;
        this.game = game;
        this.teamData = {
            playerUID: '',
            elo: 0,
            lvl: 0,
            playerName: 'Legion Bot',
            teamName: '',
            avatar: '',
            league: 0,
            rank: 0,
            dailyloot: null
        };
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
        this.incrementScore(amount);
    }

    increaseScoreFromSpell(amount: number) {
        this.incrementScore(amount);
    }

    increaseScoreFromMultiHits(amount: number) {
        if (amount > 1) {
            // Apply an exponential multiplier to the score
            this.incrementScore(Math.pow(MULTIHIT_SCORE_BASE, amount));
        }
    }

    increaseScoreFromKill(player: ServerPlayer) {
        this.incrementScore(KILL_SCORE_BONUS * (1 + (1 - player.getHPratio())));
    }

    increaseScoreFromHeal(player: ServerPlayer) {
        this.incrementScore(HEAL_SCORE_BONUS * (1 + (1 - player.getPreviousHPRatio())));
    }

    increaseScoreFromRevive(nb = 1) {
        this.incrementScore(nb * REVIVE_SCORE_BONUS);
    }

    increaseScoreFromStatusEffect() {
        this.incrementScore(STATUS_EFFECT_SCORE_BONUS);
    }

    increaseScoreFromTerrain() {
        this.incrementScore(TERRAIN_SCORE_BONUS);
    }

    increaseScoreFromDot() {
        this.incrementScore(DOT_SCORE_BONUS);
    }

    increaseScoreFromFirstBlood() {
        this.incrementScore(FIRST_BLOOD_BONUS);
    }

    incrementHealing(amount: number) {
        this.healedAmount += amount;
    }

    incrementScore(amount: number) {
        this.score = Math.min(MAX_AUDIENCE_SCORE, this.score + amount);
        // console.log(`[Team:incrementScore] ${this.id} score: ${this.score}`);
    }

    snapshotScore() {
        this._score = this.score;
    }

    sendScore() {
        if (this.score != this._score) {
            this.game.emitScoreChange(this);
        }
    }

    setSocket(socket: Socket) {
        this.socket = socket;
    }


    setPlayerData(playerData: APIPlayerData) {
        this.teamData.playerUID = playerData.uid;
        this.teamData.elo = playerData.elo;
        this.teamData.lvl = playerData.lvl;
        this.teamData.playerName = playerData.name;
        this.teamData.teamName = playerData.teamName;
        this.teamData.avatar = playerData.avatar;
        this.teamData.league = playerData.league;
        this.teamData.rank = playerData.rank; // league rank
        this.teamData.dailyloot = playerData.dailyloot;
    }

    getPlayerData() {
        return {
            teamName: this.teamData.teamName,
            playerName: this.teamData.playerName,
            playerLevel: this.teamData.lvl,
            playerRank: this.teamData.rank,
            playerAvatar: this.teamData.avatar,
            playerLeague: this.teamData.league,
        }
    }
    
    getChestKey(): ChestColor | null {
        const chestsOrder = [ChestColor.BRONZE, ChestColor.SILVER, ChestColor.GOLD];

        for (const color of chestsOrder) {
            const chest = this.teamData.dailyloot[color];
            if (!chest.hasKey && (chest.countdown === undefined || chest.countdown <= 0)) {
                return color as ChestColor; // Only one key unlocked per game
            }
        }
        return null;
    }

    getElo() {
        return this.teamData.elo;
    }

    getSocket() {
        return this.socket;
    }

    getFirebaseToken() {
        // @ts-ignore
        return this.socket?.firebaseToken;
    }

    distributeXp(xp: number) {
        const total = this.getTotalInteractedTargets();
        for (let i = 0; i < this.members.length; i++) {
            const xpRatio = (this.members[i].countInteractedTargets() / total) || 0;
            const xpShare = Math.round(xp * xpRatio);
            console.log(`[Team.distributeXp] XP share for ${this.members[i].name}: ${xpShare} (${this.members[i].countInteractedTargets()} / ${total})`);
            this.members[i].gainXP(xpShare);
        }
    }

    getCharactersDBUpdates(): CharacterUpdate[] {
        return this.members.map((member) => ({
            id: member.dbId,
            num: member.num,
            points: member.earnedStatsPoints,
            xp: member.xp,
            earnedXP: member.earnedXP,
            level: member.levelsGained
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

    incrementSpellCasts() {
        this.spellCasts++;
    }

    anySpellsUsed() {
        return this.spellCasts > 0;
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

    incrementKillStreak() {
        this.killStreak++;
    }

    resetKillStreak() {
        this.killStreak = 0;
    }

    unsetSocket() {
        this.socket = null;
    }

    getTeamSize() {
        return this.members.length;
    }
}