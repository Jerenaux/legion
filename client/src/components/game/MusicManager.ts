export class MusicManager {
    scene: Phaser.Scene;
    currentSound;
    startinIntensity = 0;
    intensity = 0;
    combatIntensity = 0;
    nbIntensities = 0;
    bridges = [];
    gameOver = false;

    constructor(scene, startinIntensity, nbIntensities, bridges) {
        this.scene = scene;
        this.currentSound = null;
        this.startinIntensity = startinIntensity;
        this.intensity = startinIntensity - 1;
        this.nbIntensities = nbIntensities;
        this.bridges = bridges;
    }

    computeMusicIntensity(ratio) {
        const thresholdValue = 1.0 / this.nbIntensities;
        for (let i = 0; i < this.nbIntensities; i++) {
            if (ratio <= i * thresholdValue) {
                return this.nbIntensities - i;
            }
        }
        return 0;
    }

    updateMusicIntensity(ratio) {
        if (this.gameOver) return;
        this.combatIntensity = this.computeMusicIntensity(ratio) + this.startinIntensity; 
        if (this.combatIntensity > this.intensity) this.intensity++;
        if (this.intensity > this.nbIntensities) this.intensity = this.nbIntensities;
    }

    playBeginning() {
        this.currentSound = this.scene.sound.add('bgm_start');
        this.currentSound.once('complete', () => this.playNext(), this);
        this.currentSound.play();
    }

    playNext() {
        this.currentSound = this.scene.sound.add(`bgm_loop_${this.intensity+1}`);
        this.currentSound.once('complete', () => this.playNext(), this);
        this.currentSound.play();
        if (this.bridges.includes(this.intensity)) this.intensity++;
    }

    playEnd() {
        this.gameOver = true;
        // if (this.currentSound && this.currentSound.isPlaying) {
        //     this.currentSound.once('complete', () => {
        //         this.scene.sound.add('bgm_end').play();
        //     });
        // } 
        this.currentSound.stop();
        this.scene.sound.add('bgm_end').play();
    }
}
