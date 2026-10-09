
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectDirection, Terrain, StatusEffect, Class, SpeedClass, TargetHighlight, LockedFeatures, SpellShopCategory } from "./enums";
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
    description: "Fire attack that sets 1 tile on fire",
    frame: 0,
    vfx: "fire_1_explosion",
    sfx: "fireball",

    radius: 1,
    charge: 'charged_fire_1',
    // projectile: 'fireball_1',
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -15, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.FIRE,
    effort: 3,

    score: 10,
    classes: [Class.BLACK_MAGE],
    minLevel: 1,
    speedClass: SpeedClass.NORMAL,
    category: SpellShopCategory.ELEMENTAL,
    unlock: LockedFeatures.SPELLS_BATCH_1,

}));

spells.push(new BaseSpell({
    id: 1,
    name: "Fire+",
    description: "Fire attack that sets 2 tiles on fire",
    frame: 1,
    vfx: "fire_2_explosion",
    sfx: "fireball",

    radius: 2,
    charge: 'charged_fire_1',
    // projectile: 'fireball_2',
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -25, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.FIRE,
    effort: 12,

    score: 20,
    classes: [Class.BLACK_MAGE],
    minLevel: 10,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 2,
    name: "Fire X",
    description: "Fire attack that sets 3 tiles on fire",
    frame: 2,
    vfx: "fire_3_explosion",
    sfx: "fireball",

    radius: 3,
    target: Target.AOE,
    // projectile: 'fireball_3',
    charge: 'charged_fire_2',
    effects: [{stat: Stat.HP, value: -60, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.FIRE,
    effort: 25,

    score: 100,
    classes: [Class.BLACK_MAGE],
    minLevel: 20,
    speedClass: SpeedClass.SLOW,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 3,
    name: "Thunder",
    description: "Unleash a thunder bolt on 1 tile and may paralyze the target for 5 turns",
    frame: 20,
    vfx: "thunder_1",
    sfx: "thunder",
    charge: 'charged_thunder_1',

    radius: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 0.5, duration: 5},
    effort: 4,

    score: 5,
    classes: [Class.BLACK_MAGE],
    minLevel: 1,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_1,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 4,
    name: "Thunder+",
    description: "Unleash a thunder bolt on 2 tiles and may paralyze the target for 7 turns",
    frame: 21,
    vfx: "thunder_2",
    sfx: "thunder",
    charge: 'charged_thunder_1',
    radius: 2,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -60, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 0.7, duration: 7},
    effort: 15,

    score: 15,
    classes: [Class.BLACK_MAGE],
    minLevel: 10,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 5,
    name: "Thunder X",
    description: "Unleash a thunder bolt on 3 tiles and may paralyze the target for 10 turns",
    frame: 22,
    vfx: "thunder_3",
    sfx: "thunder",
    charge: 'charged_thunder_2',

    radius: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -20, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 0.9, duration: 10},
    effort: 30,

    score: 50,
    classes: [Class.BLACK_MAGE],
    minLevel: 20,
    speedClass: SpeedClass.SLOW,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 6,
    name: "Ice",
    description: "Generate a pillar of ice one 1 tile and trap the target in ice",
    frame: 10,
    vfx: "ice_1",
    sfx: "ice",
    charge: 'charged_ice_1',

    radius: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 5,
    effort: 5,
    classes: [Class.BLACK_MAGE],
    minLevel: 1,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_1,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 7,
    name: "Ice+",
    description: "Generate a pillar of ice on 2 tiles and trap the targets in ice",
    frame: 11,
    vfx: "ice_2",
    sfx: "ice",
    charge: 'charged_ice_1',
    radius: 2,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -60, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 10,
    effort: 25,
    classes: [Class.BLACK_MAGE],
    minLevel: 20,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 8,
    name: "Ice X",
    description: "Generate a pillar of ice on 3 tiles and trap the targets in ice",
    frame: 12,
    vfx: "ice_3",
    sfx: "ice",
    charge: 'charged_ice_2',
    radius: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -100, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 20,
    effort: 35,
    classes: [Class.BLACK_MAGE],
    minLevel: 20,
    speedClass: SpeedClass.SLOW,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));


spells.push(new BaseSpell({
    id: 9,
    name: "Heal",
    description: "Heal a single target",
    frame: 30,
    vfx: "heal_2",
    sfx: "healing",
    

    radius: 1,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 25, modifiers: SPBasedBoost}],
    effort: 4,
    cost: 15,

    score: 5,
    classes: [Class.WHITE_MAGE],
    minLevel: 1,
    speedClass: SpeedClass.NORMAL,
    targetHighlight: TargetHighlight.ALLY,
    unlock: LockedFeatures.SPELLS_BATCH_2,
    category: SpellShopCategory.HEALING,
}));

spells.push(new BaseSpell({
    id: 10,
    name: "Poison",
    description: "Poison a single target for 10 turns, dealing damage every turn",
    frame: 3,
    vfx: "poison",
    sfx: "poison",
    

    radius: 1,
    target: Target.SINGLE,
    effects: [],
    status: {effect: StatusEffect.POISON, chance: 1, duration: 10},
    effort: 5,

    score: 10,
    classes: [Class.WHITE_MAGE],
    minLevel: 2,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_2,
    category: SpellShopCategory.STATUS,
}));

spells.push(new BaseSpell({
    id: 11,
    name: "Silence",
    description: "Make the target mute, unable to cast spells for 5 turns",
    frame: 4,
    vfx: "mute",
    sfx: "mute",

    radius: 1,
    target: Target.SINGLE,
    effects: [],
    status: {effect: StatusEffect.MUTE, chance: 1, duration: 5},
    effort: 4,

    score: 10,
    classes: [Class.WHITE_MAGE],
    minLevel: 2,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_2,
    category: SpellShopCategory.STATUS,
}));

spells.push(new BaseSpell({
    id: 12,
    name: "Revive",
    description: "Revive a single target",
    frame: 33,
    vfx: "heal_3",
    sfx: "revive",
    

    radius: 1,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 10, modifiers: SPBasedBoost, onKO: true}],
    effort: 30,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    speedClass: SpeedClass.SLOW,
    score: 20,
    classes: [Class.WHITE_MAGE],
    targetHighlight: TargetHighlight.DEAD,
    cost: 50,
    category: SpellShopCategory.HEALING,
    minLevel: 20, // For AI
}));

export function getStarterSpells(characterClass: Class):number[] {
    // Return the id's of lvl1 spells for the provided class
    return spells.filter(spell => spell.minLevel === 1 && spell.classes.includes(characterClass)).map(spell => spell.id);
}

export function getSpellsUpToLevel(characterClass: Class, level: number):number[] {
    return spells.filter(spell => spell.minLevel <= level && spell.classes.includes(characterClass)).map(spell => spell.id);
}

export function getSpellById(spellId: number): BaseSpell | undefined {
    return spells.find(spell => spell.id === spellId)!;
}

export function getRandomSpellByRarity(rarity: number): BaseSpell {
    const filtered = spells.filter(item => item.rarity === rarity);
    return filtered[Math.floor(Math.random() * filtered.length)];
}