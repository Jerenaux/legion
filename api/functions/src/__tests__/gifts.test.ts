// biome-ignore-all lint/suspicious/noExplicitAny: Small transactional Firestore fixture.
import {expect, test} from 'bun:test';
import {giftId, redeemGiftToken, validateGiftRewards} from '../gifts';
// Transaction fixture stages writes until commit, serializes concurrent calls, and
// rejects reads after writes just like Firestore. No emulator/account credentials.
function store() {
  const rows = new Map<string, any>();
  const ref = (path: string): any => ({path, id: path.split('/').at(-1), collection: (name: string) => ({doc: (id: string) => ref(`${path}/${name}/${id}`)})});
  const clone = (value: any): any => Array.isArray(value) ? value.map(clone) : value && typeof value === 'object' && !value.path ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) : value;
  let pending = Promise.resolve();
  const db: any = {
    collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
    runTransaction(fn: (tx: any) => any) {
      const next = pending.then(async () => {
        const staged = new Map<string, any>(); let wrote = false;
        const tx: any = {
          async get(reference: any) {
            if (wrote) throw new Error('Read after write');
            const value = clone(rows.get(reference.path));
            return {exists: value !== undefined, ref: reference, get: (key: string) => value?.[key], data: () => value};
          },
          getAll: (...refs: any[]) => Promise.all(refs.map(reference => tx.get(reference))),
          set(reference: any, value: any) { wrote = true; staged.set(reference.path, clone(value)); },
          create(reference: any, value: any) { if (rows.has(reference.path)) throw new Error('Already exists'); tx.set(reference, value); },
          update(reference: any, values: any) {
            wrote = true;
            const updated = clone(staged.get(reference.path) || rows.get(reference.path));
            if (!updated) throw new Error('Missing document');
            for (const [key, value] of Object.entries(values)) {
              const parts = key.split('.'); let target = updated;
              for (const part of parts.slice(0, -1)) target = target[part] ||= {};
              const field = parts.at(-1)!;
              target[field] = value?.constructor.name === 'NumericIncrementTransform' ? (target[field] || 0) + (value as any).operand : clone(value);
            }
            staged.set(reference.path, updated);
          },
        };
        const result = await fn(tx);
        staged.forEach((value, key) => { rows.set(key, value); });
        return result;
      });
      pending = next.then(() => undefined, () => undefined);
      return next;
    },
  };
  rows.set('players/p1', {gold: 100, inventory: {consumables: [0], spells: [], equipment: []}, carrying_capacity: 1, engagementStats: {completedGames: 7}});
  rows.set('players/p2', {gold: 0, inventory: {consumables: [], spells: [], equipment: []}});
  return {db, rows};
}

const token = 'a'.repeat(64);
const rewards = [{type: 'equipment', id: 2, amount: 1}, {type: 'gold', id: 0, amount: 50}, {type: 'consumable', id: 0, amount: 2}];
function gift() {
  const fixture = store();
  fixture.rows.set(`creatorGifts/${giftId(token)}`, {rewards, expiresAt: Date.now() + 60000});
  return fixture;
}

test('concurrent claims and retries grant exactly once, preserve progression, and return a receipt only to the owner', async () => {
  const {db, rows} = gift();
  const results = await Promise.all([redeemGiftToken(db, 'p1', token), redeemGiftToken(db, 'p2', token), redeemGiftToken(db, 'p1', token)]);
  expect(results.map(result => result.status)).toEqual(['claimed', 'unavailable', 'already_claimed']);
  expect(rows.get('players/p1')).toEqual({gold: 150, inventory: {consumables: [0, 0, 0], spells: [], equipment: [2]}, carrying_capacity: 1, engagementStats: {completedGames: 7}});
  expect(rows.get('players/p2').gold).toBe(0);
  expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBe('p1');
  rows.get(`creatorGifts/${giftId(token)}`).revokedAt = Date.now();
  expect((await redeemGiftToken(db, 'p1', token)).status).toBe('already_claimed');
});

test('invalid, expired, revoked and unknown links never mutate inventory', async () => {
  for (const change of [{expiresAt: Date.now() - 1}, {revokedAt: Date.now()}, {expiresAt: 'bad'}]) {
    const {db, rows} = gift();
    Object.assign(rows.get(`creatorGifts/${giftId(token)}`), change);
    expect((await redeemGiftToken(db, 'p1', token)).status).toBe('unavailable');
    expect(rows.get('players/p1').gold).toBe(100);
    expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBeUndefined();
  }
  const {db} = gift();
  for (const invalid of [null, {}, '../bad', 'b'.repeat(64), token + 'x']) {
    expect((await redeemGiftToken(db, 'p1', invalid)).status).toBe('unavailable');
  }
});

test('a missing player leaves the gift available for retry', async () => {
  const {db, rows} = gift();
  expect((await redeemGiftToken(db, 'missing', token)).status).toBe('player_not_ready');
  expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBeUndefined();
});

test('bad reward configurations fail before either document is written', async () => {
  for (const invalid of [[], [{type: 'equipment', id: 999999, amount: 1}], [{type: 'spell', id: 0, amount: -1}], [{type: 'gold', id: 0, amount: 1.5}], [{type: 'equipment', id: 2, amount: 101}], [{type: 'admin', id: 0, amount: 1}]]) {
    expect(() => validateGiftRewards(invalid)).toThrow();
    const {db, rows} = gift();
    rows.get(`creatorGifts/${giftId(token)}`).rewards = invalid;
    await expect(redeemGiftToken(db, 'p1', token)).rejects.toThrow();
    expect(rows.get('players/p1').gold).toBe(100);
    expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBeUndefined();
  }
});
