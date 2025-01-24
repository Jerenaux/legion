import { Socket } from "socket.io";

import { ServerPlayer } from "./ServerPlayer";
import { Game } from "./Game";
import { CharacterUpdate, PlayerContextData, PlayerDataForGame, TeamData } from '@legion/shared/interfaces';
import { ChestColor } from '@legion/shared/enums';
import { MAX_AUDIENCE_SCORE } from "@legion/shared/config";
import { AIServerPlayer } from "./AIServerPlayer";


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
    itemsUsed: number = 0;
    movements: number = 0;
    flames: number = 0;
    ice: number = 0;
    poison: number = 0;
    silenced: number = 0;
    paralyzed: number = 0;
    lowMP: number = 0;
    killStreak: number = 0;
    teamData: TeamData;

    constructor(number: number, game: Game) {
        this.id = number;
        this.game = game;
        this.teamData = {
            playerUID: '',
            elo: 0,
            lvl: 0,
            playerName: this.getRandomAIName(),
            teamName: '',
            avatar: '',
            league: 0,
            rank: -1,
            dailyloot: null,
            AIwinRatio: 0,
            completedGames: 0,
            engagementStats: {},
        };
    }   

    getRandomAIName() {
        const names = ['Aureus', 'Sovereign', 'Sentinel', 'Praetorian', 'Centurion', 'Gladius', 'Phalanx'];
        return names[Math.floor(Math.random() * names.length)];
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
        if (this.members.length === 0) return false; // In the case of the tutorial
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

    incrementLowMP() {
        this.lowMP++;
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


    setPlayerData(playerData: PlayerDataForGame) {
        this.teamData.playerUID = playerData.uid;
        this.teamData.elo = playerData.elo;
        this.teamData.lvl = playerData.lvl;
        this.teamData.playerName = playerData.name;
        this.teamData.teamName = playerData.teamName;
        this.teamData.avatar = playerData.avatar;
        this.teamData.league = playerData.league;
        this.teamData.rank = playerData.rank; // league rank
        this.teamData.dailyloot = playerData.dailyloot;
        this.teamData.AIwinRatio = playerData.AIwinRatio;
        this.teamData.engagementStats = playerData.engagementStats;
        this.teamData.completedGames = playerData.completedGames;
    }

    getPlayerData() {
        return {
            teamName: this.teamData.teamName,
            playerName: this.teamData.playerName,
            playerLevel: this.teamData.lvl,
            playerRank: this.teamData.rank,
            playerAvatar: this.teamData.avatar,
            playerLeague: this.teamData.league,
            completedGames: this.teamData.completedGames,
            engagementStats: this.teamData.engagementStats,
        }
    }

    getCompletedGames() {
        return this.teamData.completedGames || 0;
    }
    
    getChestKey(): ChestColor | null {
        if (!this.teamData.dailyloot) {
            return null;
        }
        // console.log(`[Team:getChestKey] Daily loot data: ${JSON.stringify(this.teamData.dailyloot)}`);
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
            // console.log(`[Team.distributeXp] XP share for ${this.members[i].name}: ${xpShare} (${this.members[i].countInteractedTargets()} / ${total})`);
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

    getEngagement() {
        console.log(`[Team:getEngagement] Getting engagement for team ${this.id}`);
        const engagement = {
            spellsUsed: this.anySpellsUsed(),
            itemsUsed: this.anyItemsUsed(),
            movements: this.movements > 0,
            attacks: this.offensiveActions > 0,
            flames: this.flames > 0,
            ice: this.ice > 0,
            poison: this.poison > 0,
            silenced: this.silenced > 0,
            paralyzed: this.paralyzed > 0,
            lowMP: this.lowMP > 0,
        };
        return engagement;
    }

    incrementOffensiveActions() {
        this.offensiveActions++;
    }

    incrementFlames() {
        this.flames++;
    }

    incrementIce() {
        this.ice++;
    }

    incrementPoison() {
        this.poison++;
    }

    incrementSilenced() {
        this.silenced++;
    }

    incrementParalyzed() {
        this.paralyzed++;
    }

    incrementMoved() {
        this.movements++;
    }

    incrementSpellCasts() {
        this.spellCasts++;
    }

    incrementItemsUsed() {
        this.itemsUsed++;
    }

    anySpellsUsed() {
        return this.spellCasts > 0;
    }

    anyItemsUsed() {
        return this.itemsUsed > 0;
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

    hasDisconnected() {
        return this.socket === null;
    }

    getTeamSize() {
        return this.members.length;
    }
    
    addWinRatio(winRatio: number) {
        this.teamData.AIwinRatio = winRatio;
    }

    scaleStats(scale: number) {
        console.log(`[Team:scaleStats] Scaling stats for team ${this.id} by ${scale}`);
        for (let i = 0; i < this.members.length; i++) {
            this.members[i].scaleStats(scale);
            // console.log(`[Team:halveStats] New stats for ${this.members[i].name}: ${JSON.stringify(this.members[i].stats)}`);
        }
    }

    setZombieInventories() {
        console.log(`[Team:setZombieInventories] Setting zombie inventories for team ${this.id}`);
        for (let i = 0; i < this.members.length; i++) {
            this.members[i].setZombieInventory();
        }
    }

    setZombieSpells() {
        console.log(`[Team:setZombieSpells] Setting zombie spells for team ${this.id}`);
        for (let i = 0; i < this.members.length; i++) {
            this.members[i].setZombieSpells();
        }
    }

    zombieLevelUp(averageLevel: number) {
        console.log(`[Team:zombieLevelUp] Zombie level up for team ${this.id} to ${averageLevel}`);
        for (let i = 0; i < this.members.length; i++) {
            this.members[i].zombieLevelUp(averageLevel);
        }
    }

    setHealRandomThreshold(threshold: number) {
        console.log(`[Team:setHealRandomThreshold] Setting heal random threshold for team ${this.id} to ${threshold}`);
        for (let i = 0; i < this.members.length; i++) {
            const member = this.members[i] as AIServerPlayer;
            member.healRandomThreshold = threshold;
        }
    }

    disableItems() {
        console.log(`[Team:disableItems] Disabling items for team ${this.id}`);
        for (let i = 0; i < this.members.length; i++) {
            const member = this.members[i] as AIServerPlayer;
            member.canUseItems = false;
        }
    }

    disableStatusEffects() {
        console.log(`[Team:disableStatusEffects] Disabling status effects for team ${this.id}`);
        for (let i = 0; i < this.members.length; i++) {
            const member = this.members[i] as AIServerPlayer;
            member.canUseStatusEffects = false;
        }
    }

    banSpells(spells: number[]) {
        for (let i = 0; i < this.members.length; i++) {
            const member = this.members[i] as AIServerPlayer;
            member.bannedSpells = spells;
        }
    }

    isGame0() {
        return this.getPlayerData().completedGames === 0;
    }
}