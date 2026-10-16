import { BaseItem } from "./BaseItem";
import { Stat, StatusEffect, Target, SpeedClass, TargetHighlight, LockedFeatures, ConsumableShopCategory } from ".";

export const items: BaseItem[] = [];

items[0] = new BaseItem({
    id: 0,
    name: "Potion",
    description: "Restores 50 HP",
    frame: 0,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.FAST,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 50}],
    effort: 0.15,
    unlock: LockedFeatures.CONSUMABLES_BATCH_1,
    category: ConsumableShopCategory.HEALING,
});

items[1] = new BaseItem({
    id: 1,
    name: "Ether",
    description: "Restores 20 MP",
    frame: 3,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.FAST,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 20}],
    effort: 0.3,
    unlock: LockedFeatures.CONSUMABLES_BATCH_1,
    category: ConsumableShopCategory.HEALING,
});

items[2] = new BaseItem({
    id: 2,
    name: "Hi-Potion",
    description: "Restores 90 HP",
    frame: 1,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.NORMAL,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 90}],
    effort: 1,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[3] = new BaseItem({
    id: 3,
    name: "Hi-Ether",
    description: "Restores 40 MP",
    frame: 4,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.NORMAL,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 40}],
    effort: 2,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[4] = new BaseItem({
    id: 4,
    name: "X-Potion",
    description: "Restores 140 HP",
    frame: 2,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.SLOW,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 140}],
    effort: 5.5,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[5] = new BaseItem({
    id: 5,
    name: "X-Ether",
    description: "Restores 60 MP",
    frame: 5,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.SLOW,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 60}],
    effort: 8,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[6] = new BaseItem({
    id: 6,
    name: "Elixir",
    description: "Restores 90 HP and 40 MP",
    frame: 6,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.NORMAL,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 90}, {stat: Stat.MP, value: 40}],
    effort: 4,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[7] = new BaseItem({
    id: 7,
    name: "X-Elixir",
    description: "Restores 140 HP and 60 MP",
    frame: 7, 
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.SLOW,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 140}, {stat: Stat.MP, value: 60}],
    effort: 18,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[8] = new BaseItem({
    id: 8,
    name: "Clover",
    description: "Revives a character with 50 HP",
    frame: 9,
    animation: "potion_heal",
    radius: 1,
    sfx: "healing",
    speedClass: SpeedClass.NORMAL,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 50, onKO: true}],
    effort: 1,
    unlock: LockedFeatures.CONSUMABLES_BATCH_1,
    targetHighlight: TargetHighlight.DEAD,
    category: ConsumableShopCategory.HEALING,
});

items[9] = new BaseItem({
    id: 9,
    name: "Concoction",
    description: "Fully restores HP and MP",
    frame: 8,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.SLOW,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: -1}, {stat: Stat.MP, value: -1}],
    effort: 20,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.HEALING,
});

items[10] = new BaseItem({
    id: 10,
    name: "Antidote",
    description: "Cures poison",
    frame: 10,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.FAST,
    target: Target.SINGLE,
    targetHighlight: TargetHighlight.ALLY,
    effects: [],
    statusRemovals: [StatusEffect.POISON],
    effort: 0.5,
    unlock: LockedFeatures.CONSUMABLES_BATCH_2,
    category: ConsumableShopCategory.STATUS,
});

items[11] = new BaseItem({
    id: 11,
    name: "Remedy",
    description: "Cures harmful status effects except ice",
    frame: 11,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.NORMAL,
    target: Target.SINGLE,
    targetHighlight: TargetHighlight.ALLY,
    effects: [],
    statusRemovals: [StatusEffect.POISON, StatusEffect.PARALYZE, StatusEffect.SLEEP, StatusEffect.BURN, StatusEffect.MUTE],
    effort: 3.5,
    unlock: LockedFeatures.CONSUMABLES_BATCH_3,
    category: ConsumableShopCategory.STATUS,
});

items[12] = new BaseItem({
    id: 12,
    name: "Bocca",
    description: "Cures silence",
    frame: 12,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.FAST,
    target: Target.SINGLE,
    targetHighlight: TargetHighlight.ALLY,
    effects: [],
    statusRemovals: [StatusEffect.MUTE],
    effort: 0.5,
    unlock: LockedFeatures.CONSUMABLES_BATCH_2,
    category: ConsumableShopCategory.STATUS,
});

items[13] = new BaseItem({
    id: 13,
    name: "Haste potion",
    description: "Hastes a character, making them get new turns faster",
    frame: 13,
    animation: "potion_heal",
    sfx: "healing",
    speedClass: SpeedClass.FAST,
    target: Target.SELF,
    effects: [],
    status: {effect: StatusEffect.HASTE, chance: 1, duration: 5},
    effort: 6,
    unlock: LockedFeatures.CONSUMABLES_BATCH_2,
    category: ConsumableShopCategory.BOOSTS,
});

export function getConsumableById(id: number): BaseItem | undefined {
    return items.find(item => item.id === id);
}

export function getRandomConsumableByRarity(rarity: number): BaseItem {
    const filtered = items.filter(item => item.rarity === rarity);
    return filtered[Math.floor(Math.random() * filtered.length)];
}

export function getStarterConsumables(effort: number):number[] {
    return items.filter(item => item.effort <= effort).map(item => item.id);
}

export const MAGE_SPECIFIC_ITEMS = [1, 3, 5, 12];