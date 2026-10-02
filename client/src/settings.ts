export interface GameSettings {
  textSize: 100 | 115 | 130;
  musicVolume: number;
  sfxVolume: number;
  keyboardLayout: 0 | 1;
  isFullscreen: boolean;
}

export const defaultGameSettings: GameSettings = {
  textSize: 100,
  musicVolume: 25,
  sfxVolume: 50,
  keyboardLayout: 1,
  isFullscreen: false,
};

const volume = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;

export function parseGameSettings(raw: string | null): GameSettings {
  try {
    const saved = raw ? JSON.parse(raw) : {};
    return {
      textSize: saved.textSize === 115 || saved.textSize === 130 ? saved.textSize : 100,
      musicVolume: volume(saved.musicVolume, defaultGameSettings.musicVolume),
      sfxVolume: volume(saved.sfxVolume, defaultGameSettings.sfxVolume),
      keyboardLayout: saved.keyboardLayout === 0 ? 0 : 1,
      isFullscreen: saved.isFullscreen === true,
    };
  } catch {
    return {...defaultGameSettings};
  }
}

export const loadGameSettings = () => parseGameSettings(localStorage.getItem("gameSettings"));

export function applyTextSize(textSize: GameSettings['textSize']) {
  document.documentElement.style.fontSize = `${textSize}%`;
  document.documentElement.style.setProperty('--text-scale', String(textSize / 100));
}
