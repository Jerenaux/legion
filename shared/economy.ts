import { Rarity } from "./enums";

export const averageRewardPerGame = 100; 

export function getPrice(effort: number) {
    return Math.floor(effort * averageRewardPerGame);
}