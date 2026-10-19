import {strict as assert} from 'node:assert';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

// Real combat consumption and Firestore persistence, without any player token on the team.
export async function checkCombatInventory({db, api, account, otherAccount}) {
  const requireServer = createRequire(new URL('../../server/package.json', import.meta.url));
  const {initializeApp, deleteApp} = requireServer('firebase-admin/app');
  const {getFirestore} = requireServer('firebase-admin/firestore');
  const {Server} = requireServer('socket.io');
  const {PvPGame} = await import('../../server/src/PvPGame');
  const {ServerPlayer} = await import('../../server/src/ServerPlayer');
  const {Item} = await import('../../server/src/Item');
  const {getConsumableById} = await import('../../shared/Items');
  const {PlayMode, League} = await import('../../shared/enums');
  const {FIRESTORE_DATABASE_ID} = await import('../../shared/config');
  const app = initializeApp({projectId: 'legion-32c6d'});
  const transport = new Server(createServer());
  const game = new PvPGame('inventory-persistence', PlayMode.CASUAL, League.BRONZE, transport);
  const character = (await db.collection('players').doc(account.uid).get()).get('characters')[0];
  const original = (await character.get()).get('inventory');
  try {
    const save = (token: string, inventory: number[]) => fetch(`${api}/inventorySave`, {
      method: 'POST', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
      body: JSON.stringify({characterId: character.id, inventory}),
    });
    assert.equal((await save(account.token, [0, 1])).status, 200, 'Old game servers remain compatible');
    const parts = account.token.split('.');
    const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    parts[1] = Buffer.from(JSON.stringify({...claims, exp: 1, iat: 0})).toString('base64url');
    // Auth emulator tokens are unsigned: changing exp exercises the real verifier's expiry path.
    for (const token of [parts.join('.'), 'invalid']) {
      assert.equal((await save(token, [])).status, 401, 'Rejected tokens must not become server errors');
      assert.deepEqual((await character.get()).get('inventory'), [0, 1]);
    }
    const team = game.teams.get(1)!;
    team.teamData.playerUID = account.uid;
    const player = new ServerPlayer(1, 'Inventory', '1', 0, 0);
    player.dbId = character.id;
    team.addMember(player);
    player.inventory = [0, 1].map(id => new Item(getConsumableById(id)));
    player.removeItem(player.inventory[0]);
    const deadline = Date.now() + 5000;
    while ((await character.get()).get('inventory').length !== 1 && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.deepEqual((await character.get()).get('inventory'), [1], 'Consumption saves without a socket or ID token');
    await game.saveInventoryToDb(otherAccount.uid, character.id, []);
    assert.deepEqual((await character.get()).get('inventory'), [1], 'Another player cannot overwrite this character');
    await game.saveInventoryToDb(account.uid, character.id, []);
    assert.deepEqual((await character.get()).get('inventory'), []);
    console.log('Combat inventories persist without player tokens; ownership, legacy saves and expired-token HTTP responses pass');
  } finally {
    await character.update({inventory: original});
    game.combatClock.dispose();
    await new Promise<void>(resolve => transport.close(() => resolve()));
    await getFirestore(app, FIRESTORE_DATABASE_ID).terminate();
    await deleteApp(app);
  }
}
