
import { Spell, EffectModifier, EffectModifiers, EffectDirection } from "./Spell";
import { Target, Stat } from "./Item";

export const spells:Spell[] = [];

const SPBasedBoostDeboost = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.SPDEF, 0.02, EffectDirection.MINUS),
);

const SPBasedBoost = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.NONE, 0, EffectDirection.PLUS)
);

// TODO: specify width and shape of AOE in target
spells[0] = new Spell(0, "Fireball", "Throws a fireball", "fireball.png", "fireball", "explosion", 6, 1, 5, Target.AOE, 3, [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}], true, 100);
spells[1] = new Spell(1, "Heal", "Heals a target", "heal.png", "healing", "potion_heal", 4, 2, 5, Target.SINGLE, 1, [{stat: Stat.HP, value: 50, modifiers: SPBasedBoost}], false, 10);
