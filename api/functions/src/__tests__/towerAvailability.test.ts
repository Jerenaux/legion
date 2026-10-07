import {expect, mock, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {UNLOCK_REWARDS} from '@legion/shared/config';
import {LockedFeatures} from '@legion/shared/enums';
import {checkFeatureUnlock, getUnlockRewards} from '../inventoryUtils';

// Run the actual HTTP handlers without initializing Firebase or sending telemetry.
const source = readFileSync(new URL('../towerAPI.ts', import.meta.url), 'utf8').replace(/^import .*;$/gm, '');
const code = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;

test('disabled Tower rejects reads and all actions before authentication or database work', async () => {
  const action = mock(async () => ({}));
  const settle = mock(async () => {});
  const authenticate = mock(async () => 'p1');
  let handled: Promise<void>;
  const handlers: Record<string, Function> = {};
  runInNewContext(code, {exports: handlers, ENABLE_CINDER_TOWER: false,
    onRequest: (_options: unknown, handler: Function) => handler,
    corsMiddleware: (_request: unknown, _response: unknown, handler: Function) => {handled = handler();},
    getUID: authenticate, checkAPIKey: () => true,
    firestore: () => ({}), towerAction: action, settleTowerBattle: settle,
  });
  for (const body of [null, {action: 'create'}, {action: 'battle'}, {action: 'upgrade'}, {action: 'retire'}]) {
    const response = {status: mock(() => response), send: mock(), json: mock()};
    await handlers.tower({method: body ? 'POST' : 'GET', body}, response);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).not.toHaveBeenCalled();
  }
  expect(authenticate).not.toHaveBeenCalled();
  expect(action).not.toHaveBeenCalled();
  // Results already in flight must still settle; disabling a mode cannot discard earned rewards.
  const response = {status: mock(() => response), send: mock(), json: mock()};
  await handlers.towerResult({method: 'POST', body: {gameId: 'tower-existing', result: {won: true}}}, response);
  await handled!;
  expect(settle).toHaveBeenCalledTimes(1);
  expect(response.json).toHaveBeenCalledWith({saved: true});
});

test('disabling Tower preserves the six-game spell unlock and its rewards', () => {
  expect(checkFeatureUnlock(6)).toBe(LockedFeatures.SPELLS_BATCH_2);
  expect(getUnlockRewards(checkFeatureUnlock(6))).toEqual(UNLOCK_REWARDS[LockedFeatures.SPELLS_BATCH_2]);
  expect(getUnlockRewards(checkFeatureUnlock(6)).map(reward => reward.amount)).toEqual([3, 200]);
});
