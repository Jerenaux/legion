import { events } from '../components/HUD/GameHUD';
import {musicGain} from '../settings';

export class MusicManager {
    scene: Phaser.Scene;
    currentSound;
    startinIntensity = 0;
    intensity = 0; // Current playing intensity level
    desiredIntensity = 0; // Desired intensity level based on game state
    playingIntensity = 0;
    loopsPlayed = 0;
    nbIntensities = 0;
    bridges = [];
    gameOver = false;
    soundConfig: { volume: number };
    volume: number;
    private musicGain = 1;
    private entryFade: Phaser.Tweens.Tween | null = null;
    private pending = new Map<string, () => void>();

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
        return musicGain();
    }

    onSettingsChanged = () => {
        const newVolume = this.getMusicVolumeFromLocalStorage();
        this.setVolume(newVolume);
    }

    setVolume(volume: number) {
        this.volume = volume;
        this.soundConfig.volume = this.volume;
        if (this.currentSound) {
            this.currentSound.setVolume(this.volume * this.musicGain);
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

        this.intensity = Math.max(this.intensity, this.desiredIntensity);
        this.prefetch();
    }

    playBeginning() {
        this.releaseCurrent();
        // Play the starting music
        this.musicGain = 0;
        this.currentSound = this.scene.sound.add('bgm_start', {...this.soundConfig, volume: 0});
        this.currentSound.once('complete', () => this.playNext(), this);
        this.currentSound.play();
        this.entryFade = this.scene.tweens.add({
            targets: this, musicGain: 1, duration: 500,
            onUpdate: () => this.setVolume(this.volume),
            onComplete: () => {this.entryFade = null;},
        });
        this.prefetch();
    }

    playNext() {
        if (this.gameOver) return;

        // Health or a bridge may already have selected the next track; let that take priority.
        if (this.intensity === this.playingIntensity && this.loopsPlayed >= 2 && this.intensity < this.nbIntensities) {
            if (this.scene.cache.audio.has(`bgm_loop_${this.intensity + 1}`)) {
                this.intensity++;
            }
        }

        // Keep the current phrase while a health-driven jump is still decoding.
        const playing = this.scene.cache.audio.has(`bgm_loop_${this.intensity}`)
            ? this.intensity : this.playingIntensity || 1;
        const key = `bgm_loop_${playing}`;
        if (!this.scene.cache.audio.has(key)) return;

        // Count actual plays, including asset fallbacks, and reset whenever the track changes.
        this.loopsPlayed = playing === this.playingIntensity ? this.loopsPlayed + 1 : 1;
        this.playingIntensity = playing;

        // Play the music at the current intensity level
        this.releaseCurrent();
        this.currentSound = this.scene.sound.add(key, this.soundConfig);
        this.currentSound.once('complete', () => this.playNext(), this);
        this.currentSound.play();

        // Handle bridges if applicable
        if (this.bridges.includes(playing)) this.intensity = Math.max(this.intensity, playing + 1);
        this.prefetch();
    }

    playEnd() {
        this.gameOver = true;
        this.releaseCurrent();
        this.requestTrack('bgm_end');
        this.playLoadedEnd();
        this.trimCache();
    }

    private playLoadedEnd() {
        if (!this.scene || !this.gameOver || this.currentSound || !this.scene.cache.audio.has('bgm_end')) return;
        this.currentSound = this.scene.sound.add('bgm_end', this.soundConfig);
        this.currentSound.play();
    }

    private stopEntryFade() {
        this.entryFade?.remove();
        this.entryFade = null;
        this.musicGain = 1;
    }

    private releaseCurrent() {
        this.stopEntryFade();
        this.currentSound?.destroy();
        this.currentSound = null;
    }

    private nextKey() {
        const next = this.intensity > this.playingIntensity ? this.intensity : Math.min(this.intensity + 1, this.nbIntensities);
        return this.gameOver ? 'bgm_end' : `bgm_loop_${next}`;
    }

    private prefetch() {
        this.requestTrack(this.nextKey());
        this.trimCache();
    }

    private requestTrack(key: string) {
        if (!this.scene || this.scene.cache.audio.has(key) || this.pending.has(key)) return;
        const loaded = () => {
            this.pending.delete(key);
            this.playLoadedEnd();
            this.trimCache();
        };
        this.pending.set(key, loaded);
        this.scene.load.once(`filecomplete-audio-${key}`, loaded);
        this.scene.load.audio(key, require(`@assets/music/${key}.wav`));
        this.scene.load.start();
    }

    private trimCache() {
        if (!this.scene) return;
        for (const key of this.scene.cache.audio.getKeys()) {
            const introFallback = !this.gameOver && !this.playingIntensity && (key === 'bgm_start' || key === 'bgm_loop_1');
            if (key.startsWith('bgm_') && !introFallback && key !== this.currentSound?.key && key !== this.nextKey()) this.scene.cache.audio.remove(key);
        }
    }

    stopAll() {
        this.stopEntryFade();
        if (this.currentSound) {
            this.currentSound.stop();
            this.currentSound.removeAllListeners();
        }
        if (this.scene) {
            this.scene.sound.removeAll(); // Removes all sounds from the scene
        }
    }

    destroy() {
        for (const [key, callback] of this.pending) this.scene?.load.off(`filecomplete-audio-${key}`, callback);
        this.pending.clear();
        this.stopAll();
        events.off('settingsChanged', this.onSettingsChanged, this);
        this.scene = null;
        this.currentSound = null;
    }
}
