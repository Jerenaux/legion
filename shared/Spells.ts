
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectDirection, Terrain, Rarity, StatusEffect, Class } from "./enums";
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

spells.push(new BaseSpell({
    id: 0,
    name: "Fire",
    description: "1x1 fire attack that sets the ground on fire",
    frame: 0,
    animation: "explosion",
    sfx: "fireball",
    shake: false,

    size: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -50, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.FIRE,
    effort: 7,

    score: 10,
    classes: [Class.BLACK_MAGE],
    minLevel: 1,
}));

spells.push(new BaseSpell({
    id: 1,
    name: "Fire+",
    description: "2x2 fire attack that sets the ground on fire",
    frame: 1,
    animation: "explosion",
    sfx: "fireball",
    shake: false,

    size: 2,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -100, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.FIRE,
    effort: 25,

    score: 20,
    classes: [Class.BLACK_MAGE],
}));

spells.push(new BaseSpell({
    id: 2,
    name: "Fire X",
    description: "3x3 fireball attack that sets the ground on fire",
    frame: 2,
    animation: "explosion",
    sfx: "fireball",
    shake: true,

    size: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -200, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.FIRE,
    effort: 50,

    score: 100,
    classes: [Class.BLACK_MAGE],
}));

spells.push(new BaseSpell({
    id: 3,
    name: "Thunder",
    description: "Unleash a 1x1 thunder bolt and may paralyze the target for 60 seconds",
    frame: 20,
    animation: "thunder",
    sfx: "thunder",
    shake: false,

    size: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 0.5, duration: 60},
    effort: 8,

    score: 5,
    classes: [Class.BLACK_MAGE],
    minLevel: 1,
}));

spells.push(new BaseSpell({
    id: 4,
    name: "Thunder+",
    description: "Unleash a 2x2 thunder bolt and may paralyze the target for 90 seconds",
    frame: 21,
    animation: "thunder",
    sfx: "thunder",
    shake: false,

    size: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -60, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 0.7, duration: 90},
    effort: 30,

    score: 15,
    classes: [Class.BLACK_MAGE],
}));

spells.push(new BaseSpell({
    id: 5,
    name: "Thunder X",
    description: "Unleash a 3x3 thunder bolt and may paralyze the target for 120 seconds",
    frame: 22,
    animation: "thunder",
    sfx: "thunder",
    shake: true,

    size: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -120, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 0.9, duration: 120},
    effort: 60,

    score: 50,
    classes: [Class.BLACK_MAGE],
}));

spells.push(new BaseSpell({
    id: 6,
    name: "Ice",
    description: "Generate a 1x1 pillar of ice and trap the target in ice",
    frame: 10,
    animation: "ice",
    sfx: "ice",
    shake: false,
    yoffset: 30,

    size: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 5,
    effort: 9,
    classes: [Class.BLACK_MAGE],
    minLevel: 1,
}));

spells.push(new BaseSpell({
    id: 7,
    name: "Ice+",
    description: "Generate a 2x2 pillar of ice and trap the targets in ice",
    frame: 11,
    animation: "ice",
    sfx: "ice",
    shake: false,
    yoffset: 30,

    size: 2,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -60, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 10,
    effort: 50,
    classes: [Class.BLACK_MAGE],
}));

spells.push(new BaseSpell({
    id: 8,
    name: "Ice X",
    description: "Generate a 3x3 pillar of ice and trap the targets in ice",
    frame: 12,
    animation: "ice",
    sfx: "ice",
    shake: false,
    yoffset: 30,

    size: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -100, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 20,
    effort: 70,
    classes: [Class.BLACK_MAGE],
}));


spells.push(new BaseSpell({
    id: 9,
    name: "Heal",
    description: "Heal a single target",
    frame: 30,
    animation: "potion_heal",
    sfx: "healing",
    shake: false,

    size: 1,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 50, modifiers: SPBasedBoost}],
    effort: 9,

    score: 5,
    classes: [Class.WHITE_MAGE],
    minLevel: 1,
}));

export function getStarterSpells(characterClass: Class):number[] {
    // Return the id's of lvl1 spells for the provided class
    return spells.filter(spell => spell.minLevel === 1 && spell.classes.includes(characterClass)).map(spell => spell.id);
}

