// The hearth crackles while the Play hall is open: the combat flame loop, quiet and gapless.
import {useEffect} from 'preact/hooks';
import flameSFX from '@assets/sfx/flame.wav';
import {sfxGain} from '../../settings';
import {sfxLevel} from '../../sfxMix';
import {events} from '../HUD/GameHUD';
import {reportAudioFailure, watchAudioContext} from '../../audioRecovery';

const LEVEL = sfxLevel('hearth');
const FADE_S = 0.8;
let buffer: Promise<AudioBuffer> | null = null;

export function useHearthSound() {
  useEffect(() => {
    let context: AudioContext;
    try { context = new AudioContext(); } catch (error) { reportAudioFailure('hearth', 'create', error); return; }
    const stopRecovery = watchAudioContext(context, 'hearth');
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
    buffer ??= fetch(flameSFX).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data));
    buffer.then(decoded => {
      if (stopped) return;
      source = context.createBufferSource();
      source.buffer = decoded;
      source.loop = true;
      source.connect(gain);
      source.start();
      setLevel(FADE_S);
    }).catch(error => {
      buffer = null;
      if (!stopped) reportAudioFailure('hearth', 'load', error, {state: context.state});
    });

    const onSettings = () => setLevel();
    events.on('settingsChanged', onSettings);
    return () => {
      stopped = true;
      stopRecovery();
      events.off('settingsChanged', onSettings);
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
