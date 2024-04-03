import { BaseItem } from "./BaseItem";
import { Stat, Target } from ".";

export const items:BaseItem[] = [];

items[0] = new BaseItem({
    id: 0,
    name: "Potion",
    description: "Restores 50 HP",
    frame: "potion.png",
    animation: "potion_heal",
    size: 2,
    sfx: "healing",
    cooldown: 2,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 50}],
    price: 10,
});

items[1] = new BaseItem({
    id: 1,
    name: "Ether",
    description: "Restores 10 MP",
    frame: "ether.png",
    animation: "potion_heal",
    size: 3,
    sfx: "healing",
    cooldown: 3,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 10}],
    price: 15,
});

items[2] = new BaseItem({
    id: 2,
    name: "Hi-Potion",
    description: "Restores 250 HP",
    frame: "hi-potion.png",
    animation: "potion_heal",
    size: 4,
    sfx: "healing",
    cooldown: 4,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 250}],
    price: 25,
});

items[3] = new BaseItem({
    id: 3,
    name: "Hi-Ether",
    description: "Restores 50 MP",
    frame: "hi-ether.png",
    animation: "potion_heal",
    size: 6,
    sfx: "healing",
    cooldown: 6,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 50}],
    price: 75,
});

items[4] = new BaseItem({
    id: 4,
    name: "X-Potion",
    description: "Restores 1000 HP",
    frame: "X-potion.png",
    animation: "potion_heal",
    size: 8,
    sfx: "healing",
    cooldown: 8,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 1000}],
    price: 200,
});

items[5] = new BaseItem({
    id: 5,
    name: "X-Ether",
    description: "Restores 200 MP",
    frame: "X-ether.png",
    animation: "potion_heal",
    size: 12,
    sfx: "healing",
    cooldown: 12,
    target: Target.SELF,
    effects: [{stat: Stat.MP, value: 200}],
    price: 300,
});

items[6] = new BaseItem({
    id: 6,
    name: "Elixir",
    description: "Restores 250 HP and 50 MP",
    frame: "elixir.png",
    animation: "potion_heal",
    size: 12,
    sfx: "healing",
    cooldown: 12,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 250}, {stat: Stat.MP, value: 50}],
    price: 150,
});

items[7] = new BaseItem({
    id: 7,
    name: "X-Elixir",
    description: "Restores 1000 HP and 200 MP",
    frame: "megalixir.png",
    animation: "potion_heal",
    size: 22,
    sfx: "healing",
    cooldown: 22,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: 1000}, {stat: Stat.MP, value: 200}],
    price: 600,
});

items[8] = new BaseItem({
    id: 8,
    name: "Clover",
    description: "Revives a KO character with 10 HP",
    frame: "clover.png",
    animation: "potion_heal",
    size: 20,
    sfx: "healing",
    cooldown: 10,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 10, onKO: true}],
    price: 200,
});

items[9] = new BaseItem({
    id: 9,
    name: "Concoction",
    description: "Fully restores HP and MP",
    frame: "concoction.png",
    animation: "potion_heal",
    size: 40,
    sfx: "healing",
    cooldown: 40,
    target: Target.SELF,
    effects: [{stat: Stat.HP, value: -1}, {stat: Stat.MP, value: -1}],
    price: 1000,
});


