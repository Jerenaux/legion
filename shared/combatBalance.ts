import {Class, Stat, SpeedClass, StatusEffect} from './enums';
import type {CharacterStringStats, Effect} from './interfaces';
import {MAX_LEVEL} from './config';

export const BALANCE_VERSION = 1;
export const MELEE_POTENCY = 28;
export const FIRE_POTENCY = 6;
export const POISON_POTENCY = 8;
export const STATUS_TURNS: Record<StatusEffect, number> = {
    [StatusEffect.FREEZE]: 3, [StatusEffect.PARALYZE]: 1, [StatusEffect.POISON]: 3,
    [StatusEffect.MUTE]: 2, [StatusEffect.BURN]: 3, [StatusEffect.SLEEP]: 1, [StatusEffect.HASTE]: 5,
    [StatusEffect.WARMTH]: 3,
};

export function levelGrowth(level: number) {
    return 1 + Math.min(20, Math.max(0, level - 1)) / 100;
}
/** Level where SP slow from 2 per level to 1, and where level growth stops. */
export const SP_FULL_RATE_LEVEL = 21;
/** SP earned by `level`: 2 per level through 21 (40 SP), then 1 per level up to the level cap. */
export function spBudget(level: number) {
    const reached = Math.min(Math.floor(level), MAX_LEVEL);
    return Math.max(0, Math.min(reached, SP_FULL_RATE_LEVEL) - 1) * 2 + Math.max(0, reached - SP_FULL_RATE_LEVEL);
}
export function baseStats(characterClass: Class, level = 1): CharacterStringStats {
    const warrior = characterClass === Class.WARRIOR;
    const white = characterClass === Class.WHITE_MAGE;
    const thief = characterClass === Class.THIEF;
    return {hp: Math.round((warrior ? 130 : white ? 120 : thief ? 120 : 110) * levelGrowth(level)),
        mp: warrior || thief ? 20 : 60, atk: warrior ? 16 : thief ? 14 : 8,
        def: warrior ? 14 : 10, spatk: warrior || thief ? 6 : 16,
        spdef: warrior || thief ? 10 : 14, speed: thief ? 24 : warrior ? 20 : 18};
}
export function spBonus(stat: Stat, points: number) {
    return stat === Stat.HP ? points * 2 : stat === Stat.SPEED ? Math.floor(points / 2) : points;
}
export function damageAmount(potency: number, level: number, attack: number, defense: number) {
    return Math.max(1, Math.round(potency * levelGrowth(level) * (50 + Math.max(0, attack)) / (50 + Math.max(0, defense))));
}
export function supportAmount(potency: number, level: number, attack: number) {
    return Math.max(1, Math.round(potency * levelGrowth(level) * (1 + Math.max(0, attack) / (100 + Math.max(0, attack)))));
}
/** Revives (spells and items) restore their effect value as a percentage of maximum HP. */
export function reviveAmount(effect: Effect, maxHP: number) {
    return Math.max(1, Math.round(maxHP * effect.value / 100));
}
export type CombatStats = {level: number; getStat: (stat: Stat) => number};
export function effectAmount(effect: Effect, caster: CombatStats, target: CombatStats) {
    if (effect.onKO) return reviveAmount(effect, target.getStat(Stat.HP));
    if (!effect.modifiers) return Math.abs(effect.value);
    return effect.value < 0
        ? damageAmount(-effect.value, caster.level, caster.getStat(Stat.SPATK), target.getStat(Stat.SPDEF))
        : supportAmount(effect.value, caster.level, caster.getStat(Stat.SPATK));
}
export const ACTION_COOLDOWNS = {[SpeedClass.PASS]: 60, [SpeedClass.FAST]: 100, [SpeedClass.NORMAL]: 150, [SpeedClass.SLOW]: 250};
export function recoveryTime(speed: number, action: SpeedClass, hasted = false) {
    const acceleration = .3 * Math.max(0, speed) / (50 + Math.max(0, speed));
    return ACTION_COOLDOWNS[action] * (1 - acceleration) * (hasted ? .85 : 1);
}
