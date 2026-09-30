import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

// Exercise the route's real failure handlers without starting Phaser or a browser.
const source = ts.createSourceFile('GamePage.tsx', readFileSync(new URL('../../routes/GamePage.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const pageClass = source.statements.find(ts.isClassDeclaration)!;
const code = ts.transpileModule(`${pageClass.getText(source)}\nGamePage;`, {
  compilerOptions: {target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React},
}).outputText;

function page() {
  const reports: unknown[] = [];
  const Page = runInNewContext(code, {
    Component: class {state = {}; setState(state: object) {Object.assign(this.state, state);}},
    PlayerContext: {}, Error, captureException: (error: unknown) => reports.push(error),
  });
  const instance = new Page({matches: {id: 'test'}});
  instance.cleanup = () => {};
  return {instance, reports};
}

test('runtime errors without an exception still show recovery', () => {
  const {instance, reports} = page();
  instance.handleRuntimeError({message: 'Cannot create WebGL context, aborting.'});
  expect(instance.state.failure?.message).toBe('Cannot create WebGL context, aborting.');
  expect(reports).toHaveLength(1);
});

test('cleanup failure cannot hide the original failure or restart recovery', () => {
  const {instance, reports} = page();
  const original = new Error('WebGL unsupported');
  const cleanup = new Error('Engine teardown failed');
  instance.cleanup = () => {throw cleanup;};
  expect(() => instance.failGame(original)).not.toThrow();
  expect(instance.state.failure).toBe(original);
  expect(reports).toEqual([original, cleanup]);
  instance.failGame(new Error('Secondary failure'));
  expect(instance.state.failure).toBe(original);
  expect(reports).toHaveLength(2);
});
