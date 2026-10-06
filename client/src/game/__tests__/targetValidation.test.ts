import {expect, mock, test} from "bun:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {Target, TargetHighlight} from "@legion/shared/enums";
import {isInSpellRange, serializeCoords} from "@legion/shared/utils";

const t = (key: string, values: Record<string, unknown> = {}) =>
  key.replace(/{{(\w+)}}/g, (_match, name) => String(values[name]));

// Execute the real input methods without loading Phaser's browser/rendering dependencies.
function inputMethods(file: string, names: string[]) {
  const source = ts.createSourceFile(file, readFileSync(new URL(`../${file}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  const owner = source.statements.find(ts.isClassDeclaration);
  if (!owner) throw new Error(`${file} class missing`);
  const methods = owner.members.filter(member => names.includes(member.name?.getText(source) ?? ""))
    .map(member => member.getText(source)).join(",\n");
  return ts.transpileModule(`({${methods}})`, {compilerOptions: {target: ts.ScriptTarget.ESNext}}).outputText;
}
const code = inputMethods("Arena.ts", ["validateTarget", "handleTileClick", "sendSpell", "sendUseItem", "refreshBox", "processActionRejected", "unlockInput"]);
const eventCode = inputMethods("Arena.ts", ["getOtherTeam", "processAttack"]);
const playerCode = inputMethods("Player.ts", ["cancelSkill", "cancelItem"]);

for (const mode of ["development", "production"]) {
  for (const action of ["spell", "item"]) {
    test(`${mode}: invalid ${action} targets send nothing and leave a valid follow-up possible`, () => {
      const arena = runInNewContext(code, {t,
        isInSpellRange, serializeCoords, Target, TargetHighlight,
        process: {env: {NODE_ENV: mode}},
        // Reproduce the former development switch: validation must not depend on it.
        VALIDATE_TARGETS: mode !== "development",
      });
      const target = {target: Target.SINGLE, targetHighlight: TargetHighlight.ENEMY};
      arena.selectedPlayer = {
        gridX: 1, gridY: 5,
        spells: [target], inventory: [target],
        pendingSpell: action === "spell" ? 0 : null,
        pendingItem: action === "item" ? 0 : null,
      };
      arena.playerTeamId = 1;
      arena.unavailableActionReason = () => undefined;
      arena.actionFeedback = mock();
      arena.gridMap = new Map([
        ["14,5", {team: {id: 2}}], // Enemy outside range.
        ["2,5", {team: {id: 1}}], // Ally inside range: also invalid.
        ["3,5", {team: {id: 2}}], // Valid enemy.
      ]);
      let spellsSent = 0;
      let itemsSent = 0;
      let rejections = 0;
      arena.sendSpell = () => {spellsSent++;};
      arena.sendUseItem = () => {itemsSent++;};
      arena.playSound = () => {rejections++;};

      // Area spells may target empty ground, but never beyond the same range limit.
      const areaSpell = {target: Target.AOE, radius: 2};
      expect(arena.validateTarget(8, 5, areaSpell)).toBe(true);
      expect(arena.validateTarget(9, 5, areaSpell)).toBe(false);

      for (const x of [14, 2, 4]) arena.handleTileClick(x, 5);
      expect(spellsSent + itemsSent).toBe(0);
      expect(rejections).toBe(3);
      expect(arena.selectedPlayer[action === "spell" ? "pendingSpell" : "pendingItem"]).toBe(0);

      arena.handleTileClick(3, 5);
      expect(spellsSent).toBe(action === "spell" ? 1 : 0);
      expect(itemsSent).toBe(action === "item" ? 1 : 0);
    });
  }
}

for (const action of ["spell", "item"]) {
  test(`sending a ${action} clears targeting before refreshing the HUD`, () => {
    const events = {emit: mock()};
    const arena = runInNewContext(code, {events});
    const player = Object.assign(runInNewContext(playerCode), {
      arena, pendingSpell: action === "spell" ? 0 : null, pendingItem: action === "item" ? 0 : null,
      inventory: [{id: 8}], canAct: () => true,
      isPlayer: true, team: {id: 1}, num: 1,
      getProps() {return {pendingSpell: this.pendingSpell, pendingItem: this.pendingItem};},
    });
    arena.selectedPlayer = player;
    arena.playerTeamId = 1;
    arena.turnee = {team: 1, num: 1};
    arena.gameSettings = {spectator: false};
    arena.send = mock();
    arena.refreshTutorial = mock();
    arena.toggleTargetMode = mock(() => expect(player.pendingSpell).toBeNull());
    arena.toggleItemMode = mock(() => expect(player.pendingItem).toBeNull());
    if (action === "spell") arena.sendSpell(3, 5, null);
    else arena.sendUseItem(0, 3, 5, null);
    expect(arena.send).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('showPlayerBox',
      {pendingSpell: null, pendingItem: null}, {pendingSpell: null, pendingItem: null}, true, true);
    if (action === "spell") expect(events.emit).toHaveBeenCalledWith('playerCastSpell_0');
  });
}

test('server rejection restores controls for the same turn, but never resets a later turn', () => {
  const toast = mock();
  const arena = runInNewContext(code, {t});
  arena.actionFeedback = toast;
  arena.turnee = {team: 1, num: 1, turnNumber: 4};
  arena.inputLocked = true;
  arena.selectedPlayer = {cancelItem: mock()};
  arena.selectTurnee = mock();
  arena.processActionRejected({team: 1, num: 1, turnNumber: 3});
  expect(arena.inputLocked).toBe(true);
  expect(toast).not.toHaveBeenCalled();
  arena.processActionRejected({team: 1, num: 1, turnNumber: 4});
  expect(arena.inputLocked).toBe(false);
  expect(arena.selectedPlayer.cancelItem).toHaveBeenCalledTimes(1);
  expect(arena.selectTurnee).toHaveBeenCalledTimes(1);
  expect(toast).toHaveBeenCalledTimes(1);
});

test('stale attack events with a missing actor or target are ignored', () => {
  const arena = runInNewContext(eventCode);
  const player = {attack: mock()};
  arena.gameEnded = false;
  arena.getPlayer = (team: number, num: number) => team === 1 && num === 1 ? player : undefined;

  expect(() => arena.processAttack({team: 1, num: 1, target: 2, hp: 0, isKill: true, sameTeam: false})).not.toThrow();
  expect(() => arena.processAttack({team: 2, num: 1, target: 1, hp: 0, isKill: true, sameTeam: false})).not.toThrow();
  expect(player.attack).not.toHaveBeenCalled();
});

const availabilityCode = inputMethods('Arena.ts', ['unavailableActionReason']);
test('action feedback distinguishes the active unit, enemy turns, and disabled characters', () => {
  const arena = runInNewContext(availabilityCode, {t});
  const active = {name: 'Luna', isPlayer: true, isInIce: () => false, canAct: () => true};
  arena.turnee = {team: 1, num: 2};
  arena.getPlayer = () => active;
  arena.selectedPlayer = active;
  expect(arena.unavailableActionReason()).toBeUndefined();
  const otherUnit = arena.unavailableActionReason({name: 'Roland'});
  expect(otherUnit).toContain('Luna');
  active.isPlayer = false;
  const enemyTurn = arena.unavailableActionReason();
  active.isPlayer = true;
  active.canAct = () => false;
  const disabled = arena.unavailableActionReason();
  active.isInIce = () => true;
  const frozen = arena.unavailableActionReason();
  // Each situation gets its own explanation; the wording itself is not under test.
  expect([enemyTurn, disabled, frozen].every(Boolean)).toBe(true);
  expect(new Set([otherUnit, enemyTurn, disabled, frozen]).size).toBe(4);
});

test('clicking the active character restores selection after inspecting another unit', () => {
  const arena = runInNewContext(code, {serializeCoords});
  const active = {isPlayer: true};
  arena.turnee = {team: 1, num: 2};
  arena.selectedPlayer = {};
  arena.gridMap = new Map([['3,5', active]]);
  arena.getPlayer = () => active;
  arena.unavailableActionReason = () => 'Luna acts now. Select the active character.';
  arena.actionFeedback = mock();
  arena.selectTurnee = mock(() => {arena.selectedPlayer = active;});
  arena.handleTileClick(3, 5);
  expect(arena.selectTurnee).toHaveBeenCalledTimes(1);
  expect(arena.selectedPlayer).toBe(active);
  expect(arena.actionFeedback).not.toHaveBeenCalled();
});

test('tutorial spell availability follows real range, team targeting, and usable spells', () => {
  const events = {emit: mock()};
  const arena = runInNewContext(inputMethods('Arena.ts', ['refreshTutorial', 'validateTarget']), {
    events, isInSpellRange, serializeCoords, Target, TargetHighlight, StatusEffect: {POISON: 0}, GRID_WIDTH: 15, GRID_HEIGHT: 12,
  });
  const active = {gridX: 1, gridY: 5, name: 'Ember', isPlayer: true, mp: 30,
    spells: [{name: 'Fire', cost: 10, target: Target.SINGLE, targetHighlight: TargetHighlight.ENEMY}],
    statuses: [0], hasUsableItem: () => false, isParalyzed: () => false, pendingSpell: null, pendingItem: null, isMuted: () => false, canAct: () => true, isInIce: () => false};
  Object.assign(arena, {tutorialManager: {}, turnee: {turnNumber: 1, team: 1, num: 3},
    playerTeamId: 1, selectedPlayer: active, getPlayer: () => active, hasEnemyNextTo: () => false, hasFlame: () => false, hexGridManager: {getTile: () => true},
    gridMap: new Map([['14,5', {gridX: 14, gridY: 5, team: {id: 2}}], ['2,5', {gridX: 2, gridY: 5, team: {id: 1}}]])});
  const context = () => {arena.refreshTutorial(); return events.emit.mock.calls.at(-1)[1];};
  expect(context().spellInRange).toBe(false);
  active.pendingSpell = 0;
  expect(context().pendingSpell).toBe(true);
  arena.gridMap.set('3,5', {gridX: 3, gridY: 5, team: {id: 2}});
  expect(context().spellInRange).toBe(true);
  expect(context().pendingSpell).toBe(true);
  arena.gridMap.delete('3,5');
  active.spells[0].target = Target.AOE;
  expect(context().spellInRange).toBe(true); // Fire can target empty ground.
  active.mp = 0;
  expect(context().hasSpells).toBe(false);
  active.mp = 30;
  active.isMuted = () => true;
  expect(context().hasSpells).toBe(false);
});

test('illustrated briefing holds readiness once, including the legacy first-match path', () => {
  const emitted: string[] = [];
  let now = 0;
  const document = {hidden: false};
  const arena = runInNewContext(inputMethods('Arena.ts', ['reportArenaReady']), {
    events: {emit: (event: string) => emitted.push(event)},
    document, window: {matchMedia: () => ({matches: false})}, performance: {now: () => now},
  });
  const socket = {connected: true, emit: mock()};
  Object.assign(arena, {gameInitialized: false, pendingEntrances: 0, socket, nextTutorialWaitingAt: 0,
    tutorialIntroPending: true, tutorialIntroShown: false, readyToken: 'first-render'});
  arena.reportArenaReady(); arena.reportArenaReady();
  expect(emitted).toEqual([]);
  expect(socket.emit.mock.calls).toEqual([['tutorialWaiting', 'first-render']]);
  now = 29_999; arena.reportArenaReady();
  expect(socket.emit).toHaveBeenCalledTimes(1);
  now = 30_000; arena.reportArenaReady();
  expect(socket.emit).toHaveBeenCalledTimes(2);
  document.hidden = true; now = 60_000; arena.reportArenaReady();
  expect(socket.emit).toHaveBeenCalledTimes(2);
  document.hidden = false; arena.reportArenaReady();
  expect(socket.emit).toHaveBeenCalledTimes(3);
  socket.emit.mockClear();
  arena.gameInitialized = true;
  arena.reportArenaReady(); arena.reportArenaReady();
  expect(emitted).toEqual(['showTutorialIntro']);
  expect(socket.emit).not.toHaveBeenCalled();
  arena.tutorialIntroPending = false;
  arena.reportArenaReady(); arena.reportArenaReady();
  expect(socket.emit.mock.calls).toEqual([['arenaReady', 'first-render']]);
  socket.emit.mockClear();
  arena.legacyFirstMatch = true; arena.tutorialIntroPending = true;
  arena.reportArenaReady();
  expect(socket.emit).not.toHaveBeenCalled();
  arena.tutorialIntroPending = false;
  arena.reportArenaReady(); arena.reportArenaReady();
  expect(socket.emit.mock.calls).toEqual([['teamRevealed']]);
});
