// The hearth crackles while the Play hall is open: the combat flame loop, quiet and gapless.
import {useEffect} from 'preact/hooks';
import flameSFX from '@assets/sfx/flame.wav';
import {sfxGain} from '../../settings';
import {events} from '../HUD/GameHUD';

const LEVEL = 0.28;
const FADE_S = 0.8;
let buffer: Promise<AudioBuffer> | null = null;

export function useHearthSound() {
  useEffect(() => {
    let context: AudioContext;
    try { context = new AudioContext(); } catch { return; }
    const gain = context.createGain();
    gain.gain.value = 0;
    gain.connect(context.destination);
    let source: AudioBufferSourceNode | null = null;
    let stopped = false;

    const target = () => LEVEL * sfxGain();
    const setLevel = (seconds = 0.2) => {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(target(), context.currentTime + seconds);
    };
    // Autoplay may hold the context until the player's first interaction.
    const resume = () => { if (context.state === 'suspended') void context.resume(); };

    buffer ??= fetch(flameSFX).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data));
    buffer.then(decoded => {
      if (stopped) return;
      source = context.createBufferSource();
      source.buffer = decoded;
      source.loop = true;
      source.connect(gain);
      source.start();
      resume();
      setLevel(FADE_S);
    }).catch(() => { buffer = null; });

    const onSettings = () => setLevel();
    events.on('settingsChanged', onSettings);
    document.addEventListener('pointerdown', resume);
    document.addEventListener('keydown', resume);
    return () => {
      stopped = true;
      events.off('settingsChanged', onSettings);
      document.removeEventListener('pointerdown', resume);
      document.removeEventListener('keydown', resume);
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, context.currentTime);
      gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.4);
      setTimeout(() => { source?.stop(); void context.close(); }, 450);
    };
  }, []);
}

/** Drop-in for class components: plays the hearth while mounted. */
export function HearthSound() {
  useHearthSound();
  return null;
}
