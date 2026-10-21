import {strict as assert} from 'node:assert';

// Real inventoryTransaction HTTP calls against the Functions and Firestore emulators: filling spell
// slots, the slot gained at level 10, replacing a learned spell in place and removing one.
export async function checkSpellLoadout({db, api, account}) {
  const {Class, InventoryType, InventoryActionType} = await import('../../shared/enums');
  const characters = (await db.collection('players').doc(account.uid).get()).get('characters');
  const mage = (await Promise.all(characters.map(async ref => ({ref, data: (await ref.get()).data()}))))
    .find(character => character.data.class === Class.BLACK_MAGE);
  assert(mage, 'New accounts include a black mage');
  const playerRef = db.collection('players').doc(account.uid);
  const scrolls = async () => (await playerRef.get()).get('inventory.spells') as number[];
  const skills = async () => (await mage.ref.get()).get('skills') as number[];
  const act = async (spellId: number, action: number, extra: Record<string, number> = {}) => {
    const spells = await scrolls();
    const index = action === InventoryActionType.UNEQUIP ? (await skills()).indexOf(spellId) : spells.indexOf(spellId);
    const response = await fetch(`${api}/inventoryTransaction`, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${account.token}`},
      body: JSON.stringify({characterId: mage.ref.id, inventoryType: InventoryType.SPELLS, action, index,
        expectedItemId: spellId, requestId: crypto.randomUUID(), ...extra}),
    });
    assert.equal(response.status, 200, await response.clone().text());
    return (await response.json()).status;
  };
  const learn = (spellId: number, extra?: Record<string, number>) => act(spellId, InventoryActionType.EQUIP, extra);

  // Fire, Thunder, Ice, Fire+, a second Ice and Thunder+.
  await mage.ref.update({level: 1, skills: [0], skill_slots: 3});
  await playerRef.update({'inventory.spells': [1, 3, 4, 6, 6]});
  assert.equal(await learn(3), 0);
  assert.equal(await learn(6), 0);
  assert.deepEqual(await skills(), [0, 3, 6]);
  assert.equal(await learn(1), 1, 'Fire+ needs level 10');

  await mage.ref.update({level: 10});
  assert.equal(await learn(6), 1, 'A known spell cannot take a second slot');
  assert.equal(await learn(1), 0, 'Level 10 opens a fourth slot without any stored change');
  assert.deepEqual(await skills(), [0, 3, 6, 1]);
  assert.equal(await learn(4), 1, 'Every slot is taken');

  assert.equal(await learn(4, {replaceIndex: 1}), 0);
  assert.deepEqual(await skills(), [0, 4, 6, 1], 'Thunder+ takes Thunder’s slot');
  assert.deepEqual(await scrolls(), [3, 6], 'Thunder returns to the shared inventory');
  assert.equal(await learn(3, {replaceIndex: 9}), 1, 'An empty slot cannot be replaced');

  assert.equal(await act(0, InventoryActionType.UNEQUIP), 0);
  assert.deepEqual(await skills(), [4, 6, 1]);
  assert.deepEqual(await scrolls(), [0, 3, 6], 'Removing Fire returns its scroll');
  assert.equal(await learn(3), 0, 'The freed slot takes another spell');
  assert.deepEqual(await skills(), [4, 6, 1, 3]);
}
