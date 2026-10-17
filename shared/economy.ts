import { Rarity } from "./enums";
import { CHARACTER_PRICES, NB_START_CHARACTERS } from "./config";

// Gold per point of effort. Independent of match rewards, so raising rewards does not raise prices.
export const PRICE_UNIT = 100;

export function getPrice(effort: number, discount = 0): number {
    return Math.round(effort * PRICE_UNIT * (1 - discount));
}

/** Price of the next recruit for a player who already owns `ownedCharacters`. */
export function getCharacterPrice(ownedCharacters: number): number {
    const index = Math.max(0, ownedCharacters - NB_START_CHARACTERS);
    return CHARACTER_PRICES[Math.min(index, CHARACTER_PRICES.length - 1)];
}

export function getRarity(effort: number): Rarity {
    if (effort < 10) return Rarity.COMMON;
    if (effort < 25) return Rarity.RARE;
    if (effort < 50) return Rarity.EPIC;
    return Rarity.LEGENDARY;
}
