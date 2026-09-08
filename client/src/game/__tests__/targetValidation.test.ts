import {expect, mock, test} from "bun:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {Target, TargetHighlight} from "@legion/shared/enums";
import {isInSpellRange, serializeCoords} from "@legion/shared/utils";

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
const playerCode = inputMethods("Player.ts", ["cancelSkill", "cancelItem"]);

for (const mode of ["development", "production"]) {
  for (const action of ["spell", "item"]) {
    test(`${mode}: invalid ${action} targets send nothing and leave a valid follow-up possible`, () => {
      const arena = runInNewContext(code, {
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
      getProps() {return {pendingSpell: this.pendingSpell, pendingItem: this.pendingItem};},
    });
    arena.selectedPlayer = player;
    arena.send = mock();
    arena.toggleTargetMode = mock(() => expect(player.pendingSpell).toBeNull());
    arena.toggleItemMode = mock(() => expect(player.pendingItem).toBeNull());
    if (action === "spell") arena.sendSpell(3, 5, null);
    else arena.sendUseItem(0, 3, 5, null);
    expect(arena.send).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('showPlayerBox', {pendingSpell: null, pendingItem: null});
    if (action === "spell") expect(events.emit).toHaveBeenCalledWith('playerCastSpell_0');
  });
}

test('server rejection restores controls for the same turn, but never resets a later turn', () => {
  const toast = mock();
  const arena = runInNewContext(code, {silentErrorToast: toast});
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
