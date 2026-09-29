import {expect, test} from 'bun:test';
import {inventoryPlayerWrite} from '../inventoryUtils';
import {equipConsumable, unequipConsumable, equipEquipment, unequipEquipment, learnSpell} from '@legion/shared/inventory';
import {NewCharacter} from '@legion/shared/NewCharacter';
import {Class, EquipmentSlot} from '@legion/shared/enums';
import {PlayerContextData} from '@legion/shared/interfaces';

test('inventory persistence never overwrites concurrent match progress or other engagement flags', () => {
    const character = new NewCharacter(Class.BLACK_MAGE, 20).getCharacterData();
    character.inventory = [0];
    character.equipment.weapon = 1;
    character.skills = [];
    const player = {inventory: {consumables: [0], equipment: [1], spells: [0]},
        engagementStats: {completedGames: 1, everUsedSpell: false, everMoved: false}} as PlayerContextData;
    const deltas = [
        equipConsumable(structuredClone(player), structuredClone(character), 0),
        unequipConsumable(structuredClone(player), structuredClone(character), 0),
        equipEquipment(structuredClone(player), structuredClone(character), 0),
        unequipEquipment(structuredClone(player), structuredClone(character), EquipmentSlot.WEAPON),
        learnSpell(structuredClone(player), structuredClone(character), 0),
    ];
    for (const delta of deltas) {
        const fields = inventoryPlayerWrite(delta!.playerUpdate);
        expect(fields.inventory).toEqual(delta!.playerUpdate.inventory);
        expect(fields).not.toHaveProperty('engagementStats');
        expect(Object.hasOwn(fields, 'engagementStats.completedGames')).toBe(false);
        expect(Object.hasOwn(fields, 'engagementStats.everUsedSpell')).toBe(false);
        expect(Object.hasOwn(fields, 'engagementStats.everMoved')).toBe(false);
        for (const [key, value] of Object.entries(fields)) {
            if (key !== 'inventory') expect(value).toBe(true);
        }
    }
    expect(inventoryPlayerWrite(deltas[0]!.playerUpdate)['engagementStats.everEquippedConsumable']).toBe(true);
    expect(inventoryPlayerWrite(deltas[2]!.playerUpdate)['engagementStats.everEquippedEquipment']).toBe(true);
    expect(inventoryPlayerWrite(deltas[4]!.playerUpdate)['engagementStats.everEquippedSpell']).toBe(true);
});
