export class MusicManager {
    scene: Phaser.Scene;
    currentSound;
    startinIntensity = 0;
    intensity = 0;
    scheduledIntensity = null;
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
        if (this.gameOver) return
        let intensity = this.computeMusicIntensity(ratio) + this.startinIntensity; 
        // console.log(`Ratio: ${ratio}, Intensity: ${intensity}`);
        if (intensity - this.intensity > 1) intensity = this.intensity + 1;
        if (intensity - this.intensity < -1) intensity = this.intensity - 1;
        // console.log(`Intensity: ${intensity}`);
        if (intensity != this.intensity) {
            this.playLoop(intensity);
        }
    }

    playBeginning() {
        this.currentSound = this.scene.sound.add('bgm_start');
        this.currentSound.once('complete', () => this.playLoop(this.intensity + 1), this);
        this.currentSound.play();
    }

    playLoop(intensity) {
        // If trying to switch to the same intensity, do nothing.
        if (this.intensity == intensity || this.scheduledIntensity) return;

        console.log(`Scheduling intensity ${intensity}`)
        // If there's a sound already playing, schedule the next one
        if (this.currentSound && this.currentSound.isPlaying) {
            this.scheduledIntensity = intensity; // mark the desired intensity
            this.currentSound.once('complete', this.switchLoop, this); // schedule the switch
        } else {
            // No sound is currently playing, so just play the desired intensity
            this.switchToIntensity(intensity);
        }
    }

    switchLoop() {
        if (this.scheduledIntensity !== null) {
            this.switchToIntensity(this.scheduledIntensity);
            this.scheduledIntensity = null; // reset the scheduled intensity
        } else {
            this.currentSound.play(); // If nothing is scheduled, replay the loop
        }
    }

    switchToIntensity(intensity) {
        console.log(`Switching to intensity ${intensity}`)
        this.intensity = intensity;
        if (this.currentSound && this.currentSound.isPlaying) {
            this.currentSound.stop();
        }
        this.currentSound = this.scene.sound.add(`bgm_loop_${intensity}`);
        if (this.bridges.includes(intensity)) {
            this.scheduledIntensity = intensity + 1;
        }
        this.currentSound.once('complete', this.switchLoop, this); // This ensures that we're always ready to switch or loop after completion
        this.currentSound.play();
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
