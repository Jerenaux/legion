import { Player } from './Player';
import { Arena } from './Arena';

export class Team {
    scene: Arena;
    id: number;
    members: Player[] = [];
    totalHPMax = 0;
    totalHP = 0;
    isPlayerTeam = false;
    score = 0;

    constructor(scene, number: number, isPlayerTeam: boolean) {
        this.scene = scene;
        this.id = number;
        this.isPlayerTeam = isPlayerTeam;
    }   

    addMember(player: Player) {
        this.members.push(player);
        this.totalHPMax += player.maxHP;
    }

    getMember(num: number) {
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
    }

    getOverview() {
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
                statuses: member.statuses
            });
        });

        return {
            members,
            score: this.score
        };
    }
}