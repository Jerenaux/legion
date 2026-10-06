import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('Firebase builds once in predeploy, with source-map credentials in the actual deploy step', () => {
  const root = resolve(import.meta.dir, '../../../..');
  const workflow = Bun.YAML.parse(readFileSync(resolve(root, '.github/workflows/deploy-api.yml'), 'utf8')) as {
    jobs: {deploy: {steps: {name?: string; run?: string; env?: Record<string, unknown>}[]}};
  };
  const steps = workflow.jobs.deploy.steps;
  const deploy = steps.find(step => step.name === 'Deploy to Firebase Functions')!;
  expect(deploy.env!.SENTRY_AUTH_TOKEN).toBe(`\${{ secrets.SENTRY_AUTH_TOKEN }}`);
  expect(deploy.env!.SENTRY_BACKEND_PROJECT).toBe(`\${{ vars.SENTRY_BACKEND_PROJECT }}`);
  expect(deploy.env!.DEPLOY).toBe(true);
  expect(steps.some(step => /bun run build/.test(step.run || ''))).toBe(false);
  const firebase = JSON.parse(readFileSync(resolve(root, 'firebase.json'), 'utf8'));
  expect(firebase.functions.predeploy).toEqual(['bun run --cwd ./api/functions build']);
});


test('opponent index gate waits for every required index and fails closed', async () => {
  const {waitForIndexes, specifications} = require('../../../../tools/backend/wait-for-indexes.cjs');
  const ready = specifications.map((spec: {fields: unknown[]}) => ({...spec, state: 'READY'}));
  let polls = 0;
  await waitForIndexes(async () => ++polls === 1 ? ready.slice(1) : ready, async () => {}, 2);
  expect(polls).toBe(2);
  await expect(waitForIndexes(async () => ready.map((index: object) => ({...index, state: 'CREATING'})), async () => {}, 1)).rejects.toThrow('not ready');
  await expect(waitForIndexes(async () => ready.map((index: object) => ({...index, state: 'NEEDS_REPAIR'})), async () => {}, 1)).rejects.toThrow('needs repair');
});
