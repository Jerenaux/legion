import { Class, Stat } from "./enums";
import { XP_PER_LEVEL } from "./config";

type StatWeights = {
    [key in Stat]?: number;
};

const classStatWeights: Record<Class, StatWeights> = {
    [Class.RANDOM]: {},
    [Class.WARRIOR]: { [Stat.ATK]: 6, [Stat.HP]: 3, [Stat.DEF]: 3, [Stat.SPATK]: 1, [Stat.SPDEF]: 1, [Stat.MP]: 1 },
    [Class.WHITE_MAGE]: { [Stat.ATK]: 1, [Stat.HP]: 2, [Stat.DEF]: 1, [Stat.SPATK]: 6, [Stat.SPDEF]: 2, [Stat.MP]: 3},
    [Class.BLACK_MAGE]: { [Stat.ATK]: 1, [Stat.HP]: 1, [Stat.DEF]: 1, [Stat.SPATK]: 6, [Stat.SPDEF]: 1, [Stat.MP]: 5 },
    [Class.THIEF]: { [Stat.ATK]: 6, [Stat.HP]: 3, [Stat.DEF]: 3, [Stat.SPATK]: 1, [Stat.SPDEF]: 1, [Stat.MP]: 1 } // TODO: update
};

export function selectStatToLevelUp(characterClass: Class): Stat {
    const weights = classStatWeights[characterClass];
    const weightedStats: Stat[] = [];

    for (const statKey in weights) {
        if (weights.hasOwnProperty(statKey)) {
            const statEnumKey = Number(statKey) as Stat;
            const weight = weights[statEnumKey];
            if (weight) {
                for (let i = 0; i < weight; i++) {
                    weightedStats.push(statEnumKey);
                }
            }
        }
    }

    const randomIndex = Math.floor(Math.random() * weightedStats.length);
    return weightedStats[randomIndex];
}


export function increaseStat(stat: Stat, currentValue: number) {
    const increments = [1, 1, 1, 1, 2, 2, 2, 3, 3, 4];
    const increment = increments[Math.floor(Math.random() * increments.length)] * getSPIncrement(stat);
    return currentValue + increment;
}


// Returns the XP needed to reach the next level, `level` being the current level
export function getXPThreshold(level: number) {
    return 50 + (level - 1) * XP_PER_LEVEL;
}

export function getSPIncrement(stat: number) {
    switch (stat) {
        case Stat.ATK:
        case Stat.DEF:
        case Stat.SPATK:
        case Stat.SPDEF:
        case Stat.SPEED:
            return 1;
        case Stat.HP:
        case Stat.MP:
            return 10;
        default:
            return 1;
    }
}

export function getMaxStatValue(stat: Stat) {
    switch (stat) {
        case Stat.ATK:
            return 1000;
        case Stat.DEF:
            return 1000;
        case Stat.SPATK:
            return 1000;
        case Stat.SPDEF:
            return 1000;
        case Stat.SPEED:
            return 195;
        case Stat.HP:
            return 10000;
        case Stat.MP:
            return 10000;
        default:
            return 1;
    }
}