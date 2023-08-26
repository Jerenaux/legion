import { Player } from './Player';

export class Team {
    scene: Phaser.Scene;
    id: number;
    members: Player[] = [];
    totalHPMax: number = 0;
    totalHP: number = 0;
    isPlayerTeam: boolean = false;

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

    updateHP() {
        this.totalHP = 0;
        this.members.forEach(member => {
            this.totalHP += member.hp;
        });

        if (this.isPlayerTeam) {
            // @ts-ignore
            this.scene.updateMusicIntensity(this.totalHP / this.totalHPMax);
        }
    }

    getOverview() {
        const members = [];
        this.members.forEach(member => {
            // @ts-ignore
            const textureFile = this.scene.assetsMap[member.texture];
            const textureFilename = textureFile.split('/').pop();
            members.push({
                texture: textureFilename,
                name: member.name,
                hp: member.hp,
                maxHP: member.maxHP,
                mp: member.mp,
                maxMP: member.maxMP,
                isAlive: member.isAlive(),
                isPlayer: member.isPlayer,
                cooldown: member.cooldownDuration,
                totalCooldown: member.totalCooldownDuration,
            });
        });

        return {members};
    }
}