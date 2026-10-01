import titleMusic from "@assets/music/title.mp3";
import {loadGameSettings} from "./settings";
import {events} from "./components/HUD/GameHUD";

export function startTitleMusic() {
  const audio = new Audio(titleMusic);
  audio.loop = true;
  const updateVolume = () => { audio.volume = loadGameSettings().musicVolume / 100; };
  const start = () => {
    if (audio.paused) void audio.play().catch(() => {
      // If autoplay is blocked, retry on the player's next interaction.
    });
  };
  updateVolume();
  start();
  document.addEventListener('pointerdown', start);
  document.addEventListener('keydown', start);
  events.on('settingsChanged', updateVolume);
  return () => {
    document.removeEventListener('pointerdown', start);
    document.removeEventListener('keydown', start);
    events.off('settingsChanged', updateVolume);
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
