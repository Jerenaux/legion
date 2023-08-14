
import { Spell, EffectModifier, EffectModifiers, EffectDirection } from "./Spell";
import { Target, Stat } from "./Item";

export const spells:Spell[] = [];

const SPBasedDamage = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.SPDEF, 0.02, EffectDirection.MINUS),
);

// damage = baseDamage * (1 + (spatk * multiplier))

// TODO: specify width and shape of AOE in target
spells[0] = new Spell(0, "Fireball", "Throws a fireball", "fireball.png", "explosion", 6, 5, Target.AOE, 3, [{stat: Stat.HP, value: -30, modifiers: SPBasedDamage}]);

