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
function gift(usage?: unknown) {
  const fixture = store();
  fixture.rows.set(`creatorGifts/${giftId(token)}`, {rewards, expiresAt: Date.now() + 60000, ...(usage === undefined ? {} : {usage})});
  return fixture;
}

for (const usage of [undefined, 'single']) test(`single-use claims and retries grant once (${usage || 'legacy'})`, async () => {
  const {db, rows} = gift(usage);
  const results = await Promise.all([redeemGiftToken(db, 'p1', token), redeemGiftToken(db, 'p2', token), redeemGiftToken(db, 'p1', token)]);
  expect(results.map(result => result.status)).toEqual(['claimed', 'unavailable', 'already_claimed']);
  expect(rows.get('players/p1')).toEqual({gold: 150, inventory: {consumables: [0, 0, 0], spells: [], equipment: [2]}, carrying_capacity: 1, engagementStats: {completedGames: 7}});
  expect(rows.get('players/p2').gold).toBe(0);
  expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBe('p1');
  rows.get(`creatorGifts/${giftId(token)}`).revokedAt = Date.now();
  expect((await redeemGiftToken(db, 'p1', token)).status).toBe('already_claimed');
});

for (const usage of ['single', 'unlimited']) test(`invalid, expired, revoked and unknown links never mutate inventory (${usage})`, async () => {
  for (const change of [{expiresAt: Date.now() - 1}, {revokedAt: Date.now()}, {expiresAt: 'bad'}]) {
    const {db, rows} = gift(usage);
    Object.assign(rows.get(`creatorGifts/${giftId(token)}`), change);
    expect((await redeemGiftToken(db, 'p1', token)).status).toBe('unavailable');
    expect(rows.get('players/p1').gold).toBe(100);
    expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBeUndefined();
  }
  const {db} = gift(usage);
  for (const invalid of [null, {}, '../bad', 'b'.repeat(64), token + 'x']) {
    expect((await redeemGiftToken(db, 'p1', invalid)).status).toBe('unavailable');
  }
});

for (const usage of ['single', 'unlimited']) test(`a missing player leaves the gift available for retry (${usage})`, async () => {
  const {db, rows} = gift(usage);
  expect((await redeemGiftToken(db, 'missing', token)).status).toBe('player_not_ready');
  expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBeUndefined();
});

for (const usage of ['single', 'unlimited']) test(`bad reward configurations roll back (${usage})`, async () => {
  for (const invalid of [[], [{type: 'equipment', id: 999999, amount: 1}], [{type: 'spell', id: 0, amount: -1}], [{type: 'gold', id: 0, amount: 1.5}], [{type: 'equipment', id: 2, amount: 101}], [{type: 'admin', id: 0, amount: 1}]]) {
    expect(() => validateGiftRewards(invalid)).toThrow();
    const {db, rows} = gift(usage);
    rows.get(`creatorGifts/${giftId(token)}`).rewards = invalid;
    await expect(redeemGiftToken(db, 'p1', token)).rejects.toThrow();
    expect(rows.get('players/p1').gold).toBe(100);
    expect(rows.get(`creatorGifts/${giftId(token)}`).claimedBy).toBeUndefined();
  }
});

test('unlimited links grant once to each account, preserve the campaign and return the original receipt', async () => {
  const {db, rows} = gift('unlimited');
  const campaign = structuredClone(rows.get(`creatorGifts/${giftId(token)}`));
  const results = await Promise.all(['p1', 'p2', 'p1', 'p2'].map(uid => redeemGiftToken(db, uid, token)));
  expect(results.map(result => result.status)).toEqual(['claimed', 'claimed', 'already_claimed', 'already_claimed']);
  expect(rows.get('players/p1').gold).toBe(150);
  expect(rows.get('players/p2').gold).toBe(50);
  for (const uid of ['p1', 'p2']) {
    expect(rows.get(`players/${uid}`).inventory.equipment).toEqual([2]);
    expect(rows.get(`creatorGifts/${giftId(token)}/claims/${uid}`).rewards).toEqual(rewards);
  }
  expect(rows.get('players/p1').engagementStats.completedGames).toBe(7);
  expect(rows.get(`creatorGifts/${giftId(token)}`)).toEqual(campaign);
  // Receipts describe what was granted, even if an operator later edits the campaign.
  rows.get(`creatorGifts/${giftId(token)}`).rewards = [];
  expect(await redeemGiftToken(db, 'p1', token)).toEqual({status: 'already_claimed', rewards});
});

test('revocation and expiry stop new recipients without removing existing receipts', async () => {
  for (const change of [{revokedAt: Date.now()}, {expiresAt: Date.now() - 1}]) {
    const {db, rows} = gift('unlimited');
    await redeemGiftToken(db, 'p1', token);
    Object.assign(rows.get(`creatorGifts/${giftId(token)}`), change);
    expect((await redeemGiftToken(db, 'p1', token)).status).toBe('already_claimed');
    expect((await redeemGiftToken(db, 'p2', token)).status).toBe('unavailable');
    expect(rows.get('players/p2').gold).toBe(0);
    expect(rows.has(`creatorGifts/${giftId(token)}/claims/p2`)).toBe(false);
  }
});

test('each campaign can be claimed independently by the same account', async () => {
  const {db, rows} = gift('unlimited');
  const second = 'b'.repeat(64);
  rows.set(`creatorGifts/${giftId(second)}`, {rewards, usage: 'unlimited'});
  const result = await Promise.all([token, second, token, second].map(value => redeemGiftToken(db, 'p1', value)));
  expect(result.map(receipt => receipt.status)).toEqual(['claimed', 'claimed', 'already_claimed', 'already_claimed']);
  expect(rows.get('players/p1').gold).toBe(200);
  expect(rows.get('players/p1').inventory.equipment).toEqual([2, 2]);
});

test('unknown usage values fail closed and leave player and claim documents unchanged', async () => {
  for (const usage of [null, '', 'multiple', true, 0, {}]) {
    const {db, rows} = gift(usage);
    expect((await redeemGiftToken(db, 'p1', token)).status).toBe('unavailable');
    expect(rows.get('players/p1').gold).toBe(100);
    expect(rows.has(`creatorGifts/${giftId(token)}/claims/p1`)).toBe(false);
  }
});
