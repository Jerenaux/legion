import { Rarity, ChestColor } from "./enums";
import { items } from "./Items";
import { spells } from "./Spells";
import { equipments } from "./Equipments";
import { AVERAGE_REWARD_PER_GAME } from "./economy";

type RewardType = 'consumable' | 'spell' | 'equipment' | 'gold';
type ItemRewardType = 'consumable' | 'spell' | 'equipment';
export type ChestReward = { type: RewardType, rarity: Rarity | null, id?: number, amount?: number, name?: string };

function getRandomType(distribution: { [key: string]: number }): ItemRewardType {
    const typeRoll = Math.random() * 100;
    let cumulativeProbability = 0;

    for (const type in distribution) {
        cumulativeProbability += distribution[type];
        if (typeRoll < cumulativeProbability) {
            return type as ItemRewardType;
        }
    }

    throw new Error('Failed to determine reward type');
}

function getRandomItem(
    rarityDistribution: { [key in Rarity]?: number[] },
    rewardTypeDistribution: { [key in ItemRewardType]: number },
    goldChance: number,
    goldAmount: number[],
    allowGold: boolean
): ChestReward {
    const rarityRoll = Math.random() * 100;
    let cumulativeProbability = 0;
    let chosenRarity: Rarity | null = null;

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

    if (allowGold && Math.random() < goldChance) {
        const goldIndex = Math.floor(Math.random() * goldAmount.length);
        return { type: 'gold', rarity: Rarity.COMMON, amount: goldAmount[goldIndex] };
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
    console.log(`Reward type: ${rewardType}, Chosen rarity: ${chosenRarity}, pool length: ${filteredPool.length}, item index: ${itemIndex}`);
    const item = filteredPool[itemIndex];
    return { type: rewardType, rarity: chosenRarity, id: item.id, name: item.name };
}

export function getChestContent(type: ChestColor): ChestReward[] {
    let allowGold = true;

    let rarityDistribution: { [key in Rarity]?: number[] };
    let rewardTypeDistribution: { [key in ItemRewardType]: number };

    switch (type) {
        case ChestColor.BRONZE:
            rarityDistribution = {
                [Rarity.COMMON]: [90],
                [Rarity.RARE]: [10],
            };
            rewardTypeDistribution = {
                consumable: 75,
                spell: 15,
                equipment: 10,
            };
            return Array.from({ length: 2 }, () => {
                const item = getRandomItem(rarityDistribution, rewardTypeDistribution, 0.1, [AVERAGE_REWARD_PER_GAME], allowGold);
                if (item.type === 'gold') {
                    allowGold = false;
                }
                return item;
            });
        case ChestColor.SILVER:
            rarityDistribution = {
                [Rarity.COMMON]: [75],
                [Rarity.RARE]: [20],
                [Rarity.EPIC]: [5],
            };
            rewardTypeDistribution = {
                consumable: 65,
                spell: 25,
                equipment: 10,
            };
            return Array.from({ length: 4 }, () => {
                const item = getRandomItem(rarityDistribution, rewardTypeDistribution, 0.1, [AVERAGE_REWARD_PER_GAME * 3], allowGold);
                if (item.type === 'gold') {
                    allowGold = false;
                }
                return item;
            });
        case ChestColor.GOLD:
            rarityDistribution = {
                [Rarity.COMMON]: [45],
                [Rarity.RARE]: [40],
                [Rarity.EPIC]: [10],
                [Rarity.LEGENDARY]: [5],
            };
            rewardTypeDistribution = {
                consumable: 40,
                spell: 30,
                equipment: 30,
            };
            return Array.from({ length: 6 }, () => {
                const item = getRandomItem(rarityDistribution, rewardTypeDistribution, 0.1, [AVERAGE_REWARD_PER_GAME * 10], allowGold);
                if (item.type === 'gold') {
                    allowGold = false;
                }
                return item;
            });
        default:
            throw new Error('Invalid ChestColor');
    }
}
