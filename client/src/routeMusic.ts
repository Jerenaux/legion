import titleMusic from "@assets/music/title.mp3";
import menuMusic from "@assets/music/menus.mp3";
import {loadGameSettings} from "./settings";
import {events} from "./components/HUD/GameHUD";

const FADE_MS = 600;
type Track = 'title' | 'menus' | null;
let audio: HTMLAudioElement | null = null;
let playing: Track = null;
let desired: Track = null;
let gain = 1;
let transition: Promise<void> | null = null;
let finishFade: (() => void) | null = null;

const updateVolume = () => {
  if (audio) audio.volume = gain * loadGameSettings().musicVolume / 100;
};
const start = () => {
  if (audio?.paused && !finishFade) void audio.play().catch(() => {
    // Retry blocked autoplay on the player's next interaction.
  });
};

function release() {
  document.removeEventListener('pointerdown', start);
  document.removeEventListener('keydown', start);
  events.off('settingsChanged', updateVolume);
  audio?.pause();
  audio?.removeAttribute('src');
  audio?.load();
  audio = null;
  playing = null;
}

function playDesired() {
  if (!desired) return;
  playing = desired;
  audio = new Audio(desired === 'title' ? titleMusic : menuMusic);
  audio.loop = true;
  gain = 1;
  updateVolume();
  start();
  document.addEventListener('pointerdown', start);
  document.addEventListener('keydown', start);
  events.on('settingsChanged', updateVolume);
}

// Resolves once outgoing music is silent, allowing the combat soundtrack to start.
export function setRouteMusic(pathname: string): Promise<void> {
  desired = pathname === '/' ? 'title' : /^\/(game|replay)(\/|$)/.test(pathname) ? null : 'menus';
  if (transition) return transition; // Finish the fade, then play the latest destination.
  if (playing === desired) return Promise.resolve();
  if (!audio || audio.paused || audio.volume === 0) {
    release();
    playDesired();
    return Promise.resolve();
  }
  const started = performance.now();
  transition = new Promise(resolve => {
    const timer = setInterval(() => {
      gain = Math.max(0, 1 - (performance.now() - started) / FADE_MS);
      updateVolume();
      if (gain === 0) finishFade?.();
    }, 20);
    finishFade = () => {
      clearInterval(timer);
      finishFade = null;
      transition = null;
      release();
      playDesired();
      resolve();
    };
  });
  return transition;
}

export function stopRouteMusic() {
  desired = null;
  if (finishFade) finishFade();
  else release();
}
