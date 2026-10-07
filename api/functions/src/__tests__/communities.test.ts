// biome-ignore-all lint/suspicious/noExplicitAny: Small transactional Firestore fixture.
import {expect, test} from 'bun:test';
import {
  SIGIL_PALETTE, SIGIL_PATTERNS, SIGIL_SHAPES, SIGIL_SYMBOLS, communitySummary, defaultSigil, isValidSigil, normalizeCommunityCode, validateCommunity,
} from '@legion/shared/communities';
import {CommunityError, joinCommunity} from '../communityStore';

// Serialized transactions with staged writes; increments and dotted paths are applied on commit.
function store(initial: Record<string, any>) {
  const rows = new Map<string, any>(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  const ref = (path: string) => ({path, id: path.split('/').at(-1)});
  let pending = Promise.resolve();
  const db: any = {
    rows,
    collection: (name: string) => ({doc: (id: string) => ref(`${name}/${id}`)}),
    runTransaction(fn: (tx: any) => any) {
      const next = pending.then(async () => {
        const staged = new Map<string, any>();
        let wrote = false;
        const tx = {
          async get(reference: any) {
            if (wrote) throw new Error('Read after write');
            const value = rows.has(reference.path) ? structuredClone(rows.get(reference.path)) : undefined;
            return {exists: value !== undefined, data: () => value};
          },
          update(reference: any, values: any) {
            wrote = true;
            const updated = structuredClone(staged.get(reference.path) ?? rows.get(reference.path));
            if (!updated) throw new Error('Missing document');
            for (const [key, value] of Object.entries(values)) {
              const increment = (value as any)?.constructor?.name === 'NumericIncrementTransform';
              updated[key] = increment ? (updated[key] || 0) + (value as any).operand : structuredClone(value);
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
  return db;
}

const sigil = {shape: 1, pattern: 2, palette: 3, symbol: 4};
const fixture = () => store({
  'players/alice': {name: 'Alice'},
  'players/bob': {name: 'Bob', community: {id: 'ravens', name: 'Ravens', tag: 'RVN', sigil, joinedAt: 1, via: 'code'}},
  'communities/kestrel': {name: 'Kestrel Guild', tag: 'KES', sigil, status: 'active', members: 2},
  'communities/ravens': {name: 'Ravens', tag: 'RVN', sigil, status: 'active', members: 1},
  'communities/gone': {name: 'Gone', tag: 'GON', sigil, status: 'revoked', members: 0},
});

test('community codes accept what players type and reject anything else', () => {
  expect(normalizeCommunityCode('  Kestrel ')).toBe('kestrel');
  expect(normalizeCommunityCode('iron-wolves')).toBe('iron-wolves');
  for (const input of ['ab', '-kestrel', 'kestrel-', 'kes trel', 'a'.repeat(25), '../x', 42, null]) expect(normalizeCommunityCode(input)).toBeNull();
});

test('default sigils are deterministic and always valid', () => {
  expect(defaultSigil('kestrel')).toEqual(defaultSigil('kestrel'));
  const seen = new Set<string>();
  for (let index = 0; index < 500; index++) {
    const value = defaultSigil(`community-${index}`);
    expect(isValidSigil(value)).toBe(true);
    seen.add(JSON.stringify(value));
  }
  expect(seen.size).toBeGreaterThan(450);
  expect(isValidSigil({shape: SIGIL_SHAPES.length, pattern: 0, palette: 0, symbol: 0})).toBe(false);
  expect(isValidSigil({shape: 0, pattern: SIGIL_PATTERNS.length - 1, palette: SIGIL_PALETTE.length - 1, symbol: SIGIL_SYMBOLS.length - 1})).toBe(true);
});

test('community validation normalizes input and rejects markup', () => {
  expect(validateCommunity({id: 'Kestrel', name: ' Kestrel Guild ', tag: 'kes', sigil})).toEqual({id: 'kestrel', name: 'Kestrel Guild', tag: 'KES', sigil});
  expect(() => validateCommunity({id: 'kestrel', name: '<b>x</b>', tag: 'KES'})).toThrow();
  expect(() => validateCommunity({id: 'kestrel', name: 'Kestrel', tag: 'TOOLONG'})).toThrow();
  expect(() => validateCommunity({id: 'kestrel', name: 'Kestrel', tag: 'KES', sigil: {...sigil, symbol: 99}})).toThrow();
  expect(communitySummary({id: 'kestrel', name: 'Kestrel', tag: 'KES', sigil, joinedAt: 5, via: 'code'})).toEqual({id: 'kestrel', name: 'Kestrel', tag: 'KES', sigil});
  expect(communitySummary({id: 'kestrel', name: 'Kestrel'})).toBeNull();
});

test('joining is permanent, idempotent for the same community, and counts members once', async () => {
  const db = fixture();
  const membership = await joinCommunity(db, 'alice', 'KESTREL', 'link');
  expect(membership).toMatchObject({id: 'kestrel', name: 'Kestrel Guild', tag: 'KES', sigil, via: 'link'});
  expect(db.rows.get('players/alice').community.id).toBe('kestrel');
  expect(db.rows.get('communities/kestrel').members).toBe(3);

  await joinCommunity(db, 'alice', 'kestrel', 'code');
  expect(db.rows.get('communities/kestrel').members).toBe(3);

  await expect(joinCommunity(db, 'alice', 'ravens', 'code')).rejects.toMatchObject({code: 'already-member'});
  await expect(joinCommunity(db, 'bob', 'kestrel', 'code')).rejects.toMatchObject({code: 'already-member'});
  expect(db.rows.get('communities/ravens').members).toBe(1);
});

test('joining rejects invalid, unknown and revoked communities without writing', async () => {
  const db = fixture();
  for (const [code, error] of [['x', 'invalid-code'], ['missing', 'not-found'], ['gone', 'not-found']] as const) {
    const attempt = joinCommunity(db, 'alice', code, 'code');
    await expect(attempt).rejects.toBeInstanceOf(CommunityError);
    await expect(attempt).rejects.toMatchObject({code: error});
  }
  await expect(joinCommunity(db, 'nobody', 'kestrel', 'code')).rejects.toMatchObject({code: 'no-player'});
  expect(db.rows.get('players/alice').community).toBeUndefined();
});
