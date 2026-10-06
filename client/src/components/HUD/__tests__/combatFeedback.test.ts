import {expect, mock, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {h, Component} from 'preact';
import ts from 'typescript';
import {InventoryType, StatusEffect} from '@legion/shared/enums';

// Exercise the actual render/input methods without loading browser-only asset dependencies.
const source = (path: string) => ts.createSourceFile(path,
  readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const compile = (code: string) => ts.transpileModule(code, {
  compilerOptions: {target: ts.ScriptTarget.ESNext, jsx: ts.JsxEmit.React, jsxFactory: 'h'},
}).outputText;
const t = (key: string, values: Record<string, unknown> = {}) =>
  key.replace(/{{(\w+)}}/g, (_match, name) => String(values[name]));
const dockSource = source('../PlayerBar.tsx');
const Dock = runInNewContext(compile(`${dockSource.statements.find(ts.isClassDeclaration)!.getText(dockSource)}\nPlayerBar;`), {
  h, Component, t, InventoryType, StatusEffect, loadGameSettings: () => ({controls: {}}), primaryKeyLabel: () => '', SPELL_SLOT_OFFSET: 6, CONTROLS_CHANGED_EVENT: 'controls',
  ItemIcon: () => null, formatNumber: String, mpIcon: '',
});
const dialogueSource = source('../TutorialDialogue.tsx');
const dialogue = runInNewContext(compile(`${dialogueSource.statements.find(ts.isFunctionDeclaration)!.getText(dialogueSource).replace('export default ', '')}\nTutorialDialogue;`), {h, t});
const playerSource = source('../../../game/Player.ts');
const methods = playerSource.statements.find(ts.isClassDeclaration)!.members
  .filter(member => ['onKey', 'useSkill'].includes(member.name?.getText(playerSource) ?? ''))
  .map(member => member.getText(playerSource)).join(',\n');
const playerCode = compile(`({${methods}})`);

type RenderNode = {
  type: unknown;
  props: {
    children?: unknown;
    className?: string;
    'aria-disabled'?: boolean;
    onClick?: (event: {stopPropagation: () => void}) => void;
  };
};

function nodes(node: unknown): RenderNode[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!('props' in node)) return [];
  const element = node as RenderNode;
  return [element, ...nodes(element.props.children)];
}

for (const muted of [false, true]) {
  test(`unavailable dock spell gives ${muted ? 'silence' : 'mana'} feedback without starting targeting`, () => {
    const feedback = mock();
    const targetMode = mock();
    const player = Object.assign(runInNewContext(playerCode, {t}), {
      isPlayer: true, team: {id: 1}, num: 1, mp: muted ? 30 : 0,
      spells: [{id: 1, name: 'Fire', cost: 8}], pendingSpell: null, pendingItem: null,
      statuses: {[StatusEffect.MUTE]: muted ? 1 : 0}, isMuted: () => muted,
      getSpellsIndex: () => 19,
      arena: {turnee: {team: 1, num: 1}, playSound: mock(), unavailableActionReason: () => undefined,
        actionFeedback: feedback, toggleTargetMode: targetMode, refreshBox: mock(), relayEvent: mock()},
    });
    const emit = mock((_event: string, slot: number) => player.onKey(slot));
    const dock = new Dock({player, canAct: true, eventEmitter: {emit}});
    const button = nodes(dock.renderActionRow(player.spells, 19, InventoryType.SPELLS)).find(node => node.type === 'button');
    expect(button.props['aria-disabled']).toBe(true);
    button.props.onClick({stopPropagation: mock()});
    expect(emit).toHaveBeenCalledWith('itemClick', 19);
    expect(feedback).toHaveBeenCalledWith(muted ? 'Silenced: choose another action.' : 'Not enough mana: needs 8 MP, you have 0.');
    expect(targetMode).not.toHaveBeenCalled();
    expect(player.pendingSpell).toBeNull();
  });
}

test('enemy-turn feedback renders without revealing coaching or a tips toggle', () => {
  const props = {visible: true, onToggle: mock()};
  expect(dialogue(props)).toBeNull();
  const tree = nodes(dialogue({...props, feedback: 'It is your opponent’s turn.'}));
  expect(tree.find(node => node.props.className === 'combat-action-feedback')?.props.children).toBe('It is your opponent’s turn.');
  expect(tree.some(node => node.type === 'button' || node.props.className === 'combat-coach-panel')).toBe(false);
});
