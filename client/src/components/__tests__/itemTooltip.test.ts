import {expect, test} from 'bun:test';
import {getEquipmentById} from '@legion/shared/Equipments';
import {getConsumableById} from '@legion/shared/Items';
import {getSpellById} from '@legion/shared/Spells';
import {Stat} from '@legion/shared/enums';
import {itemTooltip, statExplanations} from '../itemTooltip';

test('equipment tooltip shows its actual stat bonuses', () => {
  expect(itemTooltip(getEquipmentById(0))).toContain('+100 ATK\n+15 DEF');
});

test('consumables and spells show effects and casting cost', () => {
  expect(itemTooltip(getConsumableById(9))).toContain('Full HP\nFull MP');
  expect(itemTooltip(getSpellById(0))).toContain('MP to cast');
});

test('every character-sheet stat has an explanation', () => {
  for (let stat = Stat.HP; stat <= Stat.SPEED; stat++) {
    expect(statExplanations[stat].length).toBeGreaterThan(20);
  }
});
