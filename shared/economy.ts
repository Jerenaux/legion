import { Rarity } from './enums';
import { AVERAGE_GOLD_REWARD_PER_GAME } from './config';

export function getPrice(effort: number): number {
    return Math.floor(effort * AVERAGE_GOLD_REWARD_PER_GAME);
}

export function getRarity(effort: number): Rarity {
    if (effort < 10) return Rarity.COMMON;
    if (effort < 25) return Rarity.RARE;
    if (effort < 50) return Rarity.EPIC;
    return Rarity.LEGENDARY;
}
