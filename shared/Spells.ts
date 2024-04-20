
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectDirection, Terrain, Rarity, StatusEffect, Class } from "./enums";
import { EffectModifier, EffectModifiers } from "./interfaces";
import { getPrice } from "./economy";

export const spells:BaseSpell[] = [];

const SPBasedBoostDeboost = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.SPDEF, 0.02, EffectDirection.MINUS),
);

const SPBasedBoost = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.NONE, 0, EffectDirection.PLUS)
);

spells[0] = new BaseSpell({
    id: 0,
    name: "Fire X",
    description: "3x3 fireball explosion that sets the ground on fire",
    frame: "fireball.png",
    animation: "explosion",
    size: 3,
    sfx: "fireball",
    shake: true,
    cost: 5,
    cooldown: 1,
    castTime: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -300, modifiers: SPBasedBoostDeboost}],
    score: 100,
    terrain: Terrain.FIRE,
    rarity: Rarity.EPIC,
    price: getPrice(50),
    minLevel: 2,
    classes: [Class.BLACK_MAGE],
});

spells[1] = new BaseSpell({
    id: 1,
    name: "Heal",
    description: "Heals a single target",
    frame: "heal.png",
    animation: "potion_heal",
    size: 1,
    sfx: "healing",
    shake: false,
    cost: 5,
    cooldown: 4,
    castTime: 1,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 50, modifiers: SPBasedBoost}],
    score: 10,
    rarity: Rarity.COMMON,
    price: getPrice(30),
    minLevel: 3,
    classes: [Class.WHITE_MAGE],
});

spells[2] = new BaseSpell({
    id: 2,
    name: "Thunder",
    description: "Unleash a thunder bolt and paralyzes the target for 60seconds",
    frame: "thunder.png",
    animation: "thunder",
    size: 1,
    sfx: "thunder",
    shake: false,
    cost: 4,
    cooldown: 0.5,
    castTime: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -3, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 1, duration: 60},
    score: 80,
    rarity: Rarity.COMMON,
    price: getPrice(20),
    minLevel: 1,
    classes: [Class.BLACK_MAGE],
});

spells[3] = new BaseSpell({
    id: 3,
    name: "Ice",
    description: "Generate a pillar of ice and traps the target in ice",
    frame: "iceball.png",
    animation: "ice",
    size: 1,
    sfx: "ice",
    shake: false,
    cost: 4,
    cooldown: 4,
    castTime: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -3, modifiers: SPBasedBoostDeboost}],
    score: 60,
    yoffset: 30,
    terrain: Terrain.ICE,
    rarity: Rarity.COMMON,
    price: getPrice(30),
    minLevel: 1,
    classes: [Class.BLACK_MAGE, Class.WHITE_MAGE],
});