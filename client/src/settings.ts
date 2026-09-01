export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  keyboardLayout: 0 | 1;
  isFullscreen: boolean;
}

export const defaultGameSettings: GameSettings = {
  musicVolume: 50,
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
