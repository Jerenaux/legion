import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {Target, TargetHighlight} from "@legion/shared/enums";
import {isInSpellRange, serializeCoords} from "@legion/shared/utils";

// Execute the real input methods without loading Phaser's browser/rendering dependencies.
const source = ts.createSourceFile("Arena.ts", readFileSync(new URL("../Arena.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const arenaClass = source.statements.find(ts.isClassDeclaration);
if (!arenaClass) throw new Error("Arena class missing");
const methods = arenaClass.members
  .filter(member => ["validateTarget", "handleTileClick"].includes(member.name?.getText(source) ?? ""))
  .map(member => member.getText(source)).join(",\n");
const code = ts.transpileModule(`({${methods}})`, {compilerOptions: {target: ts.ScriptTarget.ESNext}}).outputText;

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
