import { BaseItem } from "./BaseItem";
import { Stat, StatusEffect, Target } from ".";

export const items: BaseItem[] = [];

items[0] = new BaseItem({
    id: 0,
    name: "Potion",
    description: "Restores 50 HP",
    frame: 0,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 2,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 50}],
    effort: 0.15    ,
});

items[1] = new BaseItem({
    id: 1,
    name: "Ether",
    description: "Restores 20 MP",
    frame: 3,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 3,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 20}],
    effort: 0.3,
});

items[2] = new BaseItem({
    id: 2,
    name: "Hi-Potion",
    description: "Restores 250 HP",
    frame: 1,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 8,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 250}],
    effort: 1,
});

items[3] = new BaseItem({
    id: 3,
    name: "Hi-Ether",
    description: "Restores 100 MP",
    frame: 4,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 12,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 100}],
    effort: 2,
});

items[4] = new BaseItem({
    id: 4,
    name: "X-Potion",
    description: "Restores 1000 HP",
    frame: 2,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 25,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 1000}],
    effort: 5.5,
});

items[5] = new BaseItem({
    id: 5,
    name: "X-Ether",
    description: "Restores 300 MP",
    frame: 5,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 40,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 300}],
    effort: 8,
});

items[6] = new BaseItem({
    id: 6,
    name: "Elixir",
    description: "Restores 250 HP and 100 MP",
    frame: 6,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 15,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 250}, {stat: Stat.MP, value: 100}],
    effort: 4,

});

items[7] = new BaseItem({
    id: 7,
    name: "X-Elixir",
    description: "Restores 1000 HP and 300 MP",
    frame: 7, 
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 50,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 1000}, {stat: Stat.MP, value: 300}],
    effort: 18,
});

items[8] = new BaseItem({
    id: 8,
    name: "Clover",
    description: "Revives a KO character with 10 HP",
    frame: 9,
    animation: "potion_heal",
    size: 1,
    sfx: "healing",
    cooldown: 10,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 10, onKO: true}],
    effort: 1,
});

items[9] = new BaseItem({
    id: 9,
    name: "Concoction",
    description: "Fully restores HP and MP",
    frame: 8,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 70,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: -1}, {stat: Stat.MP, value: -1}],
    effort: 20,
});

items[10] = new BaseItem({
    id: 10,
    name: "Antidote",
    description: "Cures poison",
    frame: 10,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 3,
    target: Target.SELF,
    effects: [],
    statusRemovals: [StatusEffect.POISON],
    effort: 0.5,
});

items[11] = new BaseItem({
    id: 11,
    name: "Remedy",
    description: "Cures all status effects",
    frame: 11,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 7,
    target: Target.SELF,
    effects: [],
    statusRemovals: [StatusEffect.POISON, StatusEffect.PARALYZE, StatusEffect.SLEEP, StatusEffect.BURN],
    effort: 3.5,
});

items[12] = new BaseItem({
    id: 12,
    name: "Bocca",
    description: "Cures silence",
    frame: 12,
    animation: "potion_heal",
    sfx: "healing",
    cooldown: 3,
    target: Target.SELF,
    effects: [],
    statusRemovals: [StatusEffect.MUTE],
    effort: 0.5,
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