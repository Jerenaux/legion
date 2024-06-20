import { Rarity, ChestColor } from "./enums";
import { items } from "./Items";
import { spells } from "./Spells";
import { equipments } from "./Equipments";
import { AVERAGE_GOLD_REWARD_PER_GAME } from "./config";

export enum RewardType {
    CONSUMABLES = 'consumable',
    SPELL = 'spell',
    EQUIPMENT = 'equipment',
    GOLD = 'gold',
}
export type ChestReward = { type: RewardType, rarity: Rarity | null, id: number, amount: number, name: string };

function getRandomType(distribution: { [key: string]: number }): RewardType {
    const typeRoll = Math.random() * 100;
    let cumulativeProbability = 0;

    for (const type in distribution) {
        cumulativeProbability += distribution[type];
        if (typeRoll < cumulativeProbability) {
            return type as RewardType;
        }
    }

    throw new Error('Failed to determine reward type');
}

function getRandomItem(
    rarityDistribution: { [key in Rarity]?: number[] },
    rewardTypeDistribution: { [key in RewardType]: number },
    goldChance: number,
    goldAmount: number,
    allowGold: boolean
): ChestReward {
    const rarityRoll = Math.random() * 100;
    let cumulativeProbability = 0;
    let chosenRarity: Rarity | null = null;

    if (allowGold && Math.random() < goldChance) {
        return { type: RewardType.GOLD, name: "gold", id: -1, rarity: Rarity.COMMON, amount: goldAmount};
    }

    for (const rarity in rarityDistribution) {
        // @ts-ignore
        cumulativeProbability += rarityDistribution[rarity as keyof Rarity].reduce((a, b) => a + b, 0);
        if (rarityRoll < cumulativeProbability) {
            // @ts-ignore
            chosenRarity = rarity as Rarity;
            break;
        }
    }

    if (chosenRarity === null) {
        throw new Error('Failed to determine rarity');
    }

    const rewardType = getRandomType(rewardTypeDistribution);

    let rewardPool;
    
    switch (rewardType) {
        case 'consumable':
            rewardPool = items;
            break;
        case 'spell':
            rewardPool = spells;
            break;
        case 'equipment':
            rewardPool = equipments;
            break;
        default:
            throw new Error('Invalid item type');
    }

    // @ts-ignore
    const filteredPool = rewardPool.filter(item => item.rarity == chosenRarity);
    if (filteredPool.length === 0) {
        console.log(`No items found for type ${rewardType} with rarity ${chosenRarity}, retrying...`);
        return getRandomItem(rarityDistribution, rewardTypeDistribution, goldChance, goldAmount, allowGold);
    }

    const itemIndex = Math.floor(Math.random() * filteredPool.length);
    // console.log(`Reward type: ${rewardType}, Chosen rarity: ${chosenRarity}, pool length: ${filteredPool.length}, item index: ${itemIndex}`);
    const item = filteredPool[itemIndex];
    return { type: rewardType, rarity: chosenRarity, id: item.id, name: item.name, amount: 1 };
}

export function getChestContent(type: ChestColor): ChestReward[] {
    let allowGold = true;

    let rarityDistribution: { [key in Rarity]?: number[] };
    let rewardTypeDistribution: { [key in RewardType]: number };
    let numberOfItems: number;
    let goldCoefficient: number;

    switch (type) {
        case ChestColor.BRONZE:
            rarityDistribution = {
                [Rarity.COMMON]: [90],
                [Rarity.RARE]: [10],
            };
            rewardTypeDistribution = {
                [RewardType.GOLD]: 0,
                [RewardType.CONSUMABLES]: 75,
                [RewardType.SPELL]: 15,
                [RewardType.EQUIPMENT]: 10,
            };
            numberOfItems = 2;
            goldCoefficient = 1;
            break;
        case ChestColor.SILVER:
            rarityDistribution = {
                [Rarity.COMMON]: [75],
                [Rarity.RARE]: [20],
                [Rarity.EPIC]: [5],
            };
            rewardTypeDistribution = {
                [RewardType.GOLD]: 0,
                [RewardType.CONSUMABLES]: 65,
                [RewardType.SPELL]: 25,
                [RewardType.EQUIPMENT]: 10,
            };
            numberOfItems = 4;
            goldCoefficient = 3;
            break;
        case ChestColor.GOLD:
            rarityDistribution = {
                [Rarity.COMMON]: [45],
                [Rarity.RARE]: [40],
                [Rarity.EPIC]: [10],
                [Rarity.LEGENDARY]: [5],
            };
            rewardTypeDistribution = {
                [RewardType.GOLD]: 0,
                [RewardType.CONSUMABLES]: 40,
                [RewardType.SPELL]: 30,
                [RewardType.EQUIPMENT]: 30,
            };
            numberOfItems = 6;
            goldCoefficient = 10;
            break;
        default:
            throw new Error('Invalid ChestColor');
    }

    return Array.from({ length: numberOfItems }, () => {
        const item = getRandomItem(rarityDistribution, rewardTypeDistribution, 0.1, AVERAGE_GOLD_REWARD_PER_GAME * goldCoefficient, allowGold);
        if (item.type == RewardType.GOLD) {
            allowGold = false;
        }
        return item;
    });
}
