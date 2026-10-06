import {ControlBindings, parseControlBindings} from "./input/bindings";

export interface GameSettings {
  textSize: 100 | 115 | 130;
  musicVolume: number;
  sfxVolume: number;
  /** Muting keeps the slider position, so unmuting restores the same level. */
  musicMuted: boolean;
  sfxMuted: boolean;
  /** Adds shapes and patterns to team and range colours, and swaps red/green pairs. */
  colorblind: boolean;
  controls: ControlBindings;
}

export const defaultGameSettings: GameSettings = {
  textSize: 100,
  musicVolume: 25,
  sfxVolume: 50,
  musicMuted: false,
  sfxMuted: false,
  colorblind: false,
  controls: {},
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
      musicMuted: saved.musicMuted === true,
      sfxMuted: saved.sfxMuted === true,
      colorblind: saved.colorblind === true,
      controls: parseControlBindings(saved.controls),
    };
  } catch {
    return {...defaultGameSettings, controls: {}};
  }
}

export const loadGameSettings = () => parseGameSettings(localStorage.getItem("gameSettings"));

/** 0–1 gain after the player's volume and mute choices. */
export const musicGain = (settings: GameSettings = loadGameSettings()) => (settings.musicMuted ? 0 : settings.musicVolume / 100);
export const sfxGain = (settings: GameSettings = loadGameSettings()) => (settings.sfxMuted ? 0 : settings.sfxVolume / 100);

export function applyTextSize(textSize: GameSettings['textSize']) {
  document.documentElement.style.fontSize = `${textSize}%`;
  document.documentElement.style.setProperty('--text-scale', String(textSize / 100));
}

/** Presentation settings that live on the document root. */
export function applyDisplaySettings(settings: GameSettings) {
  applyTextSize(settings.textSize);
  document.documentElement.toggleAttribute('data-colorblind', settings.colorblind);
}

/** Merge a change into the saved settings and apply it. */
export function saveGameSettings(change: Partial<GameSettings>) {
  const settings = {...loadGameSettings(), ...change};
  localStorage.setItem("gameSettings", JSON.stringify(settings));
  applyDisplaySettings(settings);
  return settings;
}
