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
export type ChestReward = { type: RewardType, rarity: Rarity | null, id: number, frame: number, amount: number, name: string };

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
        // Make the amount vary between 0.5*goldAmoutn and 1.5*goldAmount
        goldAmount = Math.floor(goldAmount * (0.5 + Math.random()));
        return { type: RewardType.GOLD, name: "gold", id: -1, frame: -1, rarity: Rarity.COMMON, amount: goldAmount};
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
    return { type: rewardType, rarity: chosenRarity, id: item.id, frame: item.frame, name: item.name, amount: 1 };
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
                [Rarity.COMMON]: [95],
                [Rarity.RARE]: [5],
            };
            rewardTypeDistribution = {
                [RewardType.GOLD]: 0,
                [RewardType.CONSUMABLES]: 85,
                [RewardType.SPELL]: 0,
                [RewardType.EQUIPMENT]: 15,
            };
            numberOfItems = 1;
            goldCoefficient = 1;
            break;
        case ChestColor.SILVER:
            rarityDistribution = {
                [Rarity.COMMON]: [75],
                [Rarity.RARE]: [24],
                [Rarity.EPIC]: [1],
            };
            rewardTypeDistribution = {
                [RewardType.GOLD]: 0,
                [RewardType.CONSUMABLES]: 75,
                [RewardType.SPELL]: 10,
                [RewardType.EQUIPMENT]: 15,
            };
            numberOfItems = 2;
            goldCoefficient = 3;
            break;
        case ChestColor.GOLD:
            rarityDistribution = {
                [Rarity.COMMON]: [45],
                [Rarity.RARE]: [45],
                [Rarity.EPIC]: [7],
                [Rarity.LEGENDARY]: [3],
            };
            rewardTypeDistribution = {
                [RewardType.GOLD]: 0,
                [RewardType.CONSUMABLES]: 50,
                [RewardType.SPELL]: 15,
                [RewardType.EQUIPMENT]: 35,
            };
            numberOfItems = 2;
            goldCoefficient = 5;
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
