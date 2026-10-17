// Per-sound mix, in dB. The files in public/sfx are mastered to a peak momentary loudness of -16 LUFS
// (click_2, steps, flame, equip, thud and purchase sit 1.5–7 dB lower because their peaks are limited),
// so this table alone sets the balance between sounds. Keep values at or below 0: HTML audio cannot amplify.
const MIX_DB: Record<string, number> = {
  // Spells and item effects
  fireball: 0, thunder: 0, ice: 0, poison: 0, mute: 0, revive: 0, healing: 0,
  // Combat hits and actions
  shatter: -1, thud: -1.5, slash: -4, cast: -6, cooldown: -6,
  // Feedback and ambience
  click: -1.5, steps: -8.5, nope: -12, heart: -10, flames: -12, hearth: -16,
  // Menus
  matchFound: -4, purchase: -0.5, equip: -0.5,
};

/** Linear gain for a sound before the player's SFX volume is applied. */
export const sfxLevel = (name: string) => 10 ** ((MIX_DB[name] ?? 0) / 20);
