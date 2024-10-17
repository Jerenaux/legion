import { events } from '../components/HUD/GameHUD';

export class MusicManager {
    scene: Phaser.Scene;
    currentSound;
    startinIntensity = 0;
    intensity = 0; // Current playing intensity level
    desiredIntensity = 0; // Desired intensity level based on game state
    nbIntensities = 0;
    bridges = [];
    gameOver = false;
    soundConfig: { volume: number };
    volume: number;

    constructor(scene, startinIntensity, nbIntensities, bridges) {
        this.scene = scene;
        this.currentSound = null;
        this.startinIntensity = startinIntensity;
        this.intensity = this.startinIntensity;
        this.desiredIntensity = this.startinIntensity;
        this.nbIntensities = nbIntensities;
        this.bridges = bridges;
        this.volume = this.getMusicVolumeFromLocalStorage();
        this.soundConfig = { volume: this.volume };

        // Listen for volume changes
        events.on('settingsChanged', this.onSettingsChanged, this);
    }

    getMusicVolumeFromLocalStorage(): number {
        const settingsString = localStorage.getItem('gameSettings');
        if (settingsString) {
            const settings = JSON.parse(settingsString);
            return settings.musicVolume / 100; // Convert percentage to decimal
        }
        return 0.3; // Default to 30% volume if setting is not found
    }

    onSettingsChanged = () => {
        const newVolume = this.getMusicVolumeFromLocalStorage();
        this.setVolume(newVolume);
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.soundConfig.volume = this.volume;
        if (this.currentSound) {
            this.currentSound.setVolume(this.volume);
        }
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

        // Compute the desired intensity based on the game ratio
        this.desiredIntensity = this.computeMusicIntensity(ratio) + this.startinIntensity;

        // Cap the desired intensity to the maximum available
        if (this.desiredIntensity > this.nbIntensities) {
            this.desiredIntensity = this.nbIntensities;
        }

        // Attempt to increase the current intensity towards the desired intensity
        if (this.desiredIntensity > this.intensity) {
            for (let i = this.intensity + 1; i <= this.desiredIntensity; i++) {
                const key = `bgm_loop_${i}`;
                if (this.scene.cache.audio.has(key)) {
                    this.intensity = i; // Asset is loaded; advance to this intensity
                } else {
                    // Asset not loaded; cannot advance further
                    break;
                }
            }
        }
        // Note: You can implement decreasing intensity similarly if needed
    }

    playBeginning() {
        // Play the starting music
        this.currentSound = this.scene.sound.add('bgm_start', this.soundConfig);
        this.currentSound.once('complete', () => this.playNext(), this);
        this.currentSound.play();
    }

    playNext() {
        let key = `bgm_loop_${this.intensity}`;

        // Check if the current intensity's asset is loaded
        if (!this.scene.cache.audio.has(key)) {
            // Attempt to find the highest available intensity below the desired one
            let fallbackIntensity = this.intensity;
            while (fallbackIntensity > 0) {
                key = `bgm_loop_${fallbackIntensity}`;
                if (this.scene.cache.audio.has(key)) {
                    this.intensity = fallbackIntensity;
                    break;
                }
                fallbackIntensity--;
            }

            if (fallbackIntensity === 0) {
                // No suitable asset found; cannot play background music
                console.warn('No suitable background music loaded to play.');
                return;
            }
        }

        // Play the music at the current intensity level
        this.currentSound = this.scene.sound.add(key, this.soundConfig);
        this.currentSound.once('complete', () => this.playNext(), this);
        this.currentSound.play();

        // After starting playback, attempt to advance intensity for the next loop
        if (this.intensity < this.desiredIntensity) {
            const nextIntensity = this.intensity + 1;
            const nextKey = `bgm_loop_${nextIntensity}`;
            if (this.scene.cache.audio.has(nextKey)) {
                this.intensity = nextIntensity;
            }
        }

        // Handle bridges if applicable
        if (this.bridges.includes(this.intensity)) {
            const nextIntensity = this.intensity + 1;
            const nextKey = `bgm_loop_${nextIntensity}`;
            if (this.scene.cache.audio.has(nextKey)) {
                this.intensity = nextIntensity;
            }
        }
    }

    playEnd() {
        this.gameOver = true;
        if (this.currentSound) {
            this.currentSound.stop();
        }
        this.scene.sound.add('bgm_end', this.soundConfig).play();
    }

    stopAll() {
        if (this.currentSound) {
            this.currentSound.stop();
            this.currentSound.removeAllListeners();
        }
        if (this.scene) {
            this.scene.sound.removeAll(); // Removes all sounds from the scene
        }
    }

    destroy() {
        this.stopAll();
        events.off('settingsChanged', this.onSettingsChanged, this);
        this.scene = null;
        this.currentSound = null;
    }
}
