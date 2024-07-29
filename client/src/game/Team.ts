import { Player } from './Player';
import { Arena } from './Arena';
import { PlayerProfileData, TeamOverview, TeamMember } from '@legion/shared/interfaces';


export class Team {
    scene: Arena;
    id: number;
    members: Player[] = [];
    totalHPMax = 0;
    totalHP = 0;
    isPlayerTeam = false;
    teamName: string;
    playerName: string;
    playerAvatar: string;
    playerLevel: number;
    playerRank: number;
    score = 0;

    constructor(scene, number: number, isPlayerTeam: boolean, teamData: PlayerProfileData) {
        this.scene = scene;
        this.id = number;
        this.isPlayerTeam = isPlayerTeam;
        this.teamName = teamData.teamName;
        this.playerName = teamData.playerName;
        this.playerAvatar = teamData.playerAvatar;
        this.playerLevel = teamData.playerLevel;
        this.playerRank = teamData.playerRank;
    }   

    addMember(player: Player): void {
        this.members.push(player);
        this.totalHPMax += player.maxHP;
    }

    getMember(num: number): Player {
        return this.members[num - 1];
    }

    getMembers(): Player[] {
        return this.members;
    }

    calculateHealthRatio(totalHP: number, totalHPMax: number): number {
        // Ensure that the value does not go below 0 when totalHP is less than totalHPMax / 2
        const adjustedHP = Math.max(0, totalHP - (totalHPMax / 2));
        // Adjust the scale so that it maps from 0 to 1 over the range from totalHPMax / 2 to totalHPMax
        const ratio = (2 * adjustedHP) / totalHPMax;
        return ratio;
    }

    updateHP() {
        this.totalHP = 0;
        this.members.forEach(member => {
            this.totalHP += member.hp;
        });

        if (this.isPlayerTeam) {
            this.scene.updateMusicIntensity(this.calculateHealthRatio(this.totalHP, this.totalHPMax));
        }
    }

    setScore(score: number) {
        this.score = score;
        console.log(`Team ${this.id} score: ${this.score}`);
    }

    getOverview(): TeamOverview {
        const members = [];
        this.members.forEach(member => {
            members.push({
                texture: member.texture,
                name: member.name,
                hp: member.hp,
                maxHP: member.maxHP,
                mp: member.mp,
                maxMP: member.maxMP,
                isAlive: member.isAlive(),
                isPlayer: member.isPlayer,
                cooldown: member.cooldownDuration,
                totalCooldown: member.totalCooldownDuration,
                statuses: member.statuses,
                class: member.class,
                xp: member.xp,
                level: member.level,
            } as TeamMember);
        });

        return {
            members,
            player: {
                teamName: this.teamName,
                playerName: this.playerName,
                playerAvatar: this.playerAvatar,
                playerLevel: this.playerLevel,
                playerRank: this.playerRank
            },
            score: this.score,
            isPlayerTeam: this.isPlayerTeam
        };
    }
}