
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
    cost: 10,
    name: "Fire",
    description: "Burn 1 tile.",
    frame: 0,
    vfx: "fire_1_explosion",
    sfx: "fireball",

    radius: 1,
    charge: 'charged_fire_1',
    // projectile: 'fireball_1',
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -26, modifiers: SPBasedBoostDeboost}],
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
    cost: 18,
    name: "Fire+",
    description: "Burn 7 tiles.",
    frame: 1,
    vfx: "fire_2_explosion",
    sfx: "fireball",

    radius: 2,
    charge: 'charged_fire_1',
    // projectile: 'fireball_2',
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -22, modifiers: SPBasedBoostDeboost}],
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
    cost: 28,
    name: "Fire X",
    description: "Burn 19 tiles.",
    frame: 2,
    vfx: "fire_3_explosion",
    sfx: "fireball",

    radius: 3,
    target: Target.AOE,
    // projectile: 'fireball_3',
    charge: 'charged_fire_2',
    effects: [{stat: Stat.HP, value: -18, modifiers: SPBasedBoostDeboost}],
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
    cost: 14,
    name: "Thunder",
    description: "Strike 1 tile and paralyze targets for 1 turn.",
    frame: 20,
    vfx: "thunder_1",
    sfx: "thunder",
    charge: 'charged_thunder_1',

    radius: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -24, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 1, duration: 1},
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
    cost: 24,
    name: "Thunder+",
    description: "Strike 7 tiles and paralyze targets for 1 turn.",
    frame: 21,
    vfx: "thunder_2",
    sfx: "thunder",
    charge: 'charged_thunder_1',
    radius: 2,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -20, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 1, duration: 1},
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
    cost: 36,
    name: "Thunder X",
    description: "Strike 19 tiles and paralyze targets for 1 turn.",
    frame: 22,
    vfx: "thunder_3",
    sfx: "thunder",
    charge: 'charged_thunder_2',

    radius: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -16, modifiers: SPBasedBoostDeboost}],
    status: {effect: StatusEffect.PARALYZE, chance: 1, duration: 1},
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
    cost: 16,
    name: "Ice",
    description: "Cover 1 tile in ice. Trapped characters lose 3 turns but take no damage, except from poison.",
    frame: 10,
    vfx: "ice_1",
    sfx: "ice",
    charge: 'charged_ice_1',

    radius: 1,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -18, modifiers: SPBasedBoostDeboost}],
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
    cost: 28,
    name: "Ice+",
    description: "Cover 7 tiles in ice. Trapped characters lose 3 turns but take no damage, except from poison.",
    frame: 11,
    vfx: "ice_2",
    sfx: "ice",
    charge: 'charged_ice_1',
    radius: 2,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -15, modifiers: SPBasedBoostDeboost}],
    terrain: Terrain.ICE,

    score: 10,
    effort: 25,
    classes: [Class.BLACK_MAGE],
    minLevel: 10,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    category: SpellShopCategory.ELEMENTAL,
}));

spells.push(new BaseSpell({
    id: 8,
    cost: 40,
    name: "Ice X",
    description: "Cover 19 tiles in ice. Trapped characters lose 3 turns but take no damage, except from poison.",
    frame: 12,
    vfx: "ice_3",
    sfx: "ice",
    charge: 'charged_ice_2',
    radius: 3,
    target: Target.AOE,
    effects: [{stat: Stat.HP, value: -12, modifiers: SPBasedBoostDeboost}],
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
    cost: 15,
    name: "Heal",
    description: "Heal a single target",
    frame: 30,
    vfx: "heal_2",
    sfx: "healing",
    

    radius: 1,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 28, modifiers: SPBasedBoost}],
    effort: 4,

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
    cost: 12,
    name: "Poison",
    description: "Poison a target for 3 turns.",
    frame: 3,
    vfx: "poison",
    sfx: "poison",
    

    radius: 1,
    target: Target.SINGLE,
    effects: [],
    status: {effect: StatusEffect.POISON, chance: 1, duration: 3},
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
    cost: 16,
    name: "Silence",
    description: "Prevent a target from casting spells for 2 turns.",
    frame: 4,
    vfx: "mute",
    sfx: "mute",

    radius: 1,
    target: Target.SINGLE,
    effects: [],
    status: {effect: StatusEffect.MUTE, chance: 1, duration: 2},
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
    cost: 35,
    name: "Revive",
    description: "Revive a fallen character with 30% of their maximum HP.",
    frame: 33,
    vfx: "heal_3",
    sfx: "revive",
    

    radius: 1,
    target: Target.SINGLE,
    effects: [{stat: Stat.HP, value: 30, onKO: true}],
    effort: 30,
    unlock: LockedFeatures.SPELLS_BATCH_3,
    speedClass: SpeedClass.SLOW,
    score: 20,
    classes: [Class.WHITE_MAGE],
    targetHighlight: TargetHighlight.DEAD,
    category: SpellShopCategory.HEALING,
    minLevel: 20, // For AI
}));

spells.push(new BaseSpell({
    id: 13,
    cost: 18,
    name: "Warmth",
    description: "Melt the ice on 7 tiles and keep it from forming there for the caster's next 3 turns.",
    frame: 34,
    vfx: "heal_2",
    vfxTint: 0xffa040,
    sfx: "healing",

    radius: 2,
    target: Target.AOE,
    effects: [],
    warmth: 3,
    effort: 10,

    score: 10,
    classes: [Class.WHITE_MAGE],
    minLevel: 5,
    speedClass: SpeedClass.NORMAL,
    unlock: LockedFeatures.SPELLS_BATCH_2,
    category: SpellShopCategory.STATUS,
}));

export function getStarterSpells(characterClass: Class):number[] {
    // Return the id's of lvl1 spells for the provided class
    return spells.filter(spell => spell.minLevel === 1 && spell.classes.includes(characterClass)).map(spell => spell.id);
}

export function getSpellsUpToLevel(characterClass: Class, level: number):number[] {
    return spells.filter(spell => spell.minLevel <= level && spell.classes.includes(characterClass)).map(spell => spell.id);
}

/** Tiers of one element share a family: Fire, Fire+ and Fire X are all "Fire". */
export function spellFamily(spell: Pick<BaseSpell, 'name'>): string {
    return spell.name.replace(/(\+| X)$/, '');
}

export function getSpellById(spellId: number): BaseSpell | undefined {
    return spells.find(spell => spell.id === spellId)!;
}

export function getRandomSpellByRarity(rarity: number): BaseSpell {
    const filtered = spells.filter(item => item.rarity === rarity);
    return filtered[Math.floor(Math.random() * filtered.length)];
}