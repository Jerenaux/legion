// biome-ignore-all lint/suspicious/noExplicitAny: Partial Firestore transaction fixture with heterogeneous documents.
import {expect, test} from 'bun:test';
import {towerAction, settleTowerBattle} from '../towerStore';
import {TOWER_ENCOUNTERS, TowerBattleResult, TowerRun} from '@legion/shared/tower';

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
  rows.set('players/p1', {gold: 100, xp: 0, elo: 500, engagementStats: {completedGames: 7}, characters: [ref('characters/a'), ref('characters/b')], inventory: {consumables: [8], spells: [], equipment: []}});
  for (const id of ['a', 'b']) rows.set(`characters/${id}`, {xp: 0, level: 1, sp: 0, allTimeSP: 0, inventory: [0], skills: [9], stats: {hp: 999}});
  return {db, rows};
}
const action = (run: TowerRun, name: string, extra = {}) => ({action: name, runId: run.id, revision: run.revision, ...extra});
const victory = (run: TowerRun): TowerBattleResult => ({won: true, units: run.squad.map(unit => ({hp: unit.hp, mp: unit.mp, inventory: unit.character.inventory}))});

test('authenticated progression rejects locked tiers, stale choices, and another player’s state', async () => {
  const {db, rows} = store();
  await expect(towerAction(db, 'p1', {action: 'create', tier: 2, kit: 'balanced'})).rejects.toThrow();
  await expect(towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'control'})).rejects.toThrow();
  await expect(towerAction(db, 'p2', null)).rejects.toThrow();
  let {run} = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'});
  const retried = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'});
  expect(retried.run!.id).toBe(run!.id);
  await expect(towerAction(db, 'p1', action(run!, 'battle', {encounter: 'warden'}))).rejects.toThrow();
  const old = run!;
  ({run} = await towerAction(db, 'p1', action(run!, 'battle', {encounter: 'gate'})));
  await expect(towerAction(db, 'p1', action(old, 'retire'))).rejects.toThrow();
  await expect(towerAction(db, 'p1', action(run!, 'retire'))).rejects.toThrow();
  expect(rows.get('players/p1').gold).toBe(100);
});

test('concurrent/retried settlement banks each milestone once and never overwrites roster state', async () => {
  const {db, rows} = store();
  let {run} = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'});
  for (let floor = 0; floor < 6; floor++) {
    ({run} = await towerAction(db, 'p1', action(run!, 'battle', {encounter: TOWER_ENCOUNTERS[floor][0].id})));
    const gameId = run!.gameId!;
    const result = victory(run!);
    await Promise.all([settleTowerBattle(db, gameId, result), settleTowerBattle(db, gameId, result)]);
    ({run} = await towerAction(db, 'p1', null));
    expect(rows.get('players/p1').engagementStats.completedGames).toBe(floor < 5 ? 7 : 8);
    if (floor < 5) ({run} = await towerAction(db, 'p1', action(run!, 'upgrade', {upgrade: 'rest'})));
  }
  const player = rows.get('players/p1');
  expect(player.gold).toBe(855); expect(player.xp).toBe(900); expect(player.towerHighestClear).toBe(1);
  expect(player.elo).toBe(500); expect(player.engagementStats.completedGames).toBe(8);
  expect(player.inventory.consumables).toEqual([8, 0, 1]); expect(player.inventory.spells).toEqual([6]);
  expect(run!.phase).toBe('won');
  for (const id of ['a', 'b']) {
    const character = rows.get(`characters/${id}`);
    expect(character.level).toBe(4); expect(character.xp).toBe(150); expect(character.sp).toBe(9);
    expect(character.stats).toEqual({hp: 999}); expect(character.inventory).toEqual([0]); expect(character.skills).toEqual([9]);
  }
  const next = await towerAction(db, 'p1', {action: 'create', tier: 2, kit: 'control'});
  expect(next.run!.tier).toBe(2);
});

test('invalid results roll back, and defeat preserves earlier rewards', async () => {
  const {db, rows} = store();
  let {run} = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'});
  ({run} = await towerAction(db, 'p1', action(run!, 'battle', {encounter: 'gate'})));
  const corrupt = victory(run!); corrupt.units[0].inventory = [999];
  await expect(settleTowerBattle(db, run!.gameId!, corrupt)).rejects.toThrow();
  expect(rows.get('players/p1').gold).toBe(100);
  await settleTowerBattle(db, run!.gameId!, victory(run!));
  ({run} = await towerAction(db, 'p1', null));
  ({run} = await towerAction(db, 'p1', action(run!, 'upgrade', {upgrade: 'rest'})));
  ({run} = await towerAction(db, 'p1', action(run!, 'battle', {encounter: 'sanctum'})));
  await settleTowerBattle(db, run!.gameId!, {won: false, units: victory(run!).units.map(unit => ({...unit, hp: 0}))});
  ({run} = await towerAction(db, 'p1', null));
  expect(run!.phase).toBe('lost'); expect(run!.earned.gold).toBe(20); expect(rows.get('players/p1').gold).toBe(320);
  expect(rows.get('players/p1').engagementStats.completedGames).toBe(8);
});


test('Tower requires six completed matches after the introductory tutorial, including direct API calls', async () => {
  const {db, rows} = store();
  for (const count of [0, 1, 6]) {
    rows.get('players/p1').engagementStats.completedGames = count;
    await expect(towerAction(db, 'p1', null)).rejects.toThrow('Complete more matches');
    for (const action of ['create', 'battle', 'upgrade']) {
      await expect(towerAction(db, 'p1', {action, tier: 1, kit: 'balanced'})).rejects.toThrow('Complete more matches');
    }
    expect(rows.has('players/p1/tower/current')).toBe(false);
  }
  rows.get('players/p1').engagementStats.completedGames = 7;
  expect((await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'})).run?.phase).toBe('ready');
});

test('retirement, giving up, and legacy abandonments never earn progression credit', async () => {
  const {db, rows} = store();
  let {run} = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'});
  await towerAction(db, 'p1', action(run!, 'retire'));
  expect(rows.get('players/p1').engagementStats.completedGames).toBe(7);
  for (const abandoned of [true, undefined]) {
    ({run} = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'}));
    ({run} = await towerAction(db, 'p1', action(run!, 'battle', {encounter: 'gate'})));
    const result = {...victory(run!), won: false, abandoned};
    await Promise.all([settleTowerBattle(db, run!.gameId!, result), settleTowerBattle(db, run!.gameId!, result)]);
    expect(rows.get('players/p1').engagementStats.completedGames).toBe(7);
    expect(rows.get('players/p1').gold).toBe(100);
  }
});

test('a defeated expedition grants the matching unlock reward once without consuming owned items', async () => {
  const {db, rows} = store();
  rows.get('players/p1').engagementStats.completedGames = 9;
  let {run} = await towerAction(db, 'p1', {action: 'create', tier: 1, kit: 'balanced'});
  ({run} = await towerAction(db, 'p1', action(run!, 'battle', {encounter: 'gate'})));
  const result = {won: false, units: victory(run!).units.map(unit => ({...unit, hp: 0}))};
  await Promise.all([settleTowerBattle(db, run!.gameId!, result), settleTowerBattle(db, run!.gameId!, result)]);
  const player = rows.get('players/p1');
  expect(player.engagementStats.completedGames).toBe(10);
  expect(player.inventory.consumables).toEqual([8, 11]);
  expect(player.gold).toBe(300);
  expect(player.elo).toBe(500);
});
