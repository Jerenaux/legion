
import { BaseSpell } from "./BaseSpell";
import { Stat, Target, EffectModifiers, EffectModifier, EffectDirection } from "./types";

export const spells:BaseSpell[] = [];

const SPBasedBoostDeboost = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.SPDEF, 0.02, EffectDirection.MINUS),
);

const SPBasedBoost = new EffectModifiers(
    new EffectModifier(Stat.SPATK, 0.1, EffectDirection.PLUS),
    new EffectModifier(Stat.NONE, 0, EffectDirection.PLUS)
);

// Cooldown, cast time, cost
spells[0] = new BaseSpell(0, "Fire", "Throw a fireball", "fireball.png", "fireball", "explosion", 6, 1, 5, Target.AOE, 3, [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}], true, 100);
spells[1] = new BaseSpell(1, "Heal", "Heals a target", "heal.png", "healing", "potion_heal", 4, 1, 5, Target.SINGLE, 1, [{stat: Stat.HP, value: 50, modifiers: SPBasedBoost}], false, 10);
spells[2] = new BaseSpell(2, "Thunder", "Unleash a thunder bolt", "thunder.png", "thunder", "thunder", 4, 1, 4, Target.SINGLE, 1, [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}], false, 80);
spells[3] = new BaseSpell(3, "Ice", "Generate a pillar of ice", "iceball.png", "ice", "ice", 4, 1, 4, Target.SINGLE, 1, [{stat: Stat.HP, value: -30, modifiers: SPBasedBoostDeboost}], false, 60);

