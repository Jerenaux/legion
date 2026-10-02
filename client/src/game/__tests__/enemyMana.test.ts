import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const source = ts.createSourceFile('Arena.ts', readFileSync(new URL('../Arena.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
const methods = source.statements.find(ts.isClassDeclaration)!.members
  .filter(member => ['placeCharacter', 'processMPChange'].includes(member.name?.getText(source) ?? ''));
const code = ts.transpileModule(`new class {${methods.map(method => method.getText(source)).join('\n')}}`, {
  compilerOptions: {target: ts.ScriptTarget.ESNext},
}).outputText;

test('enemy placement retains its spells and mana updates target the correct team', () => {
  class Player {
    spells: number[] = [];
    mp: number;
    setSpells(spells: number[]) {this.spells = spells;}
    setStatuses() {}
    setMP(mp: number) {this.mp = mp;}
  }
  const arena = runInNewContext(code, {Player, serializeCoords: () => 'tile'});
  arena.playerTeamId = 1;
  arena.refreshTutorial = () => {};
  arena.hexGridToPixelCoords = () => ({x: 0, y: 0});
  arena.gridMap = new Map();
  const members: Player[] = [];
  const enemyTeam = {id: 2, getMembers: () => members, addMember: (player: Player) => members.push(player)};
  arena.placeCharacter({spells: [8]}, enemyTeam, true);
  expect(members[0].spells).toEqual([8]);
  arena.placeCharacter({}, enemyTeam, true); // Older snapshots have no enemy spells or mana.
  expect(members[1].spells).toEqual([]);
  const ally = new Player();
  arena.getPlayer = (team: number) => team === 1 ? ally : members[0];
  arena.processMPChange({team: 2, num: 1, mp: 7});
  expect(members[0].mp).toBe(7);
  expect(ally.mp).toBeUndefined();
  arena.processMPChange({num: 1, mp: 22});
  expect(ally.mp).toBe(22);
  expect(members[0].mp).toBe(7);
});
