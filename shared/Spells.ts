
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectDirection, Terrain } from "./enums";
import { EffectModifier, EffectModifiers } from "./interfaces";

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
    name: "Fire",
    description: "Throw a fireball",
    frame: "fireball.png",
    animation: "explosion",
    size: 3,
    sfx: "fireball",
    shake: true,
    cost: 5,
    cooldown: 1,
    castTime: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    score: 100,
    terrain: Terrain.FIRE
});

spells[1] = new BaseSpell({
    id: 1,
    name: "Heal",
    description: "Heals a target",
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
});

spells[2] = new BaseSpell({
    id: 2,
    name: "Thunder",
    description: "Unleash a thunder bolt",
    frame: "thunder.png",
    animation: "thunder",
    size: 1,
    sfx: "thunder",
    shake: false,
    cost: 4,
    cooldown: 0.5,
    castTime: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    score: 80,
});

spells[3] = new BaseSpell({
    id: 3,
    name: "Ice",
    description: "Generate a pillar of ice",
    frame: "iceball.png",
    animation: "ice",
    size: 1,
    sfx: "ice",
    shake: false,
    cost: 4,
    cooldown: 4,
    castTime: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    score: 60,
    yoffset: 30,
});