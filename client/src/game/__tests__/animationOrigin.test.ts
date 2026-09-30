import {expect, test} from "bun:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {getSpellById} from "@legion/shared/Spells";
import {VFXconfig, VFX_DISPLAY_SCALE} from "../VFXconfig";

// Run the real handlers without Phaser's browser/rendering dependencies.
const source = ts.createSourceFile("Arena.ts", readFileSync(new URL("../Arena.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const owner = source.statements.find(ts.isClassDeclaration)!;
const methods = owner.members.filter(member => ["processLocalAnimation", "displayAttackImpact", "yToZ"].includes(member.name?.getText(source) ?? ""))
  .map(member => member.getText(source)).join(",\n");
const code = ts.transpileModule(`({${methods}})`, {compilerOptions: {target: ts.ScriptTarget.ESNext}}).outputText;

for (const id of [0, 6, 9, null]) {
  test(`${id === null ? "attack impact" : getSpellById(id).name} keeps its placement after Thunder`, () => {
    const arena = runInNewContext(code, {
      getSpellById, VFXconfig, VFX_DISPLAY_SCALE, LOCAL_ANIMATION_SCALE: 2, DEPTH_OFFSET: 0.01, PROJECTILE_DURATION: 1,
      console: {log() {}},
    });
    const sprite = {
      x: 0, y: 0, originX: 0.5, originY: 0.7, scaleX: 1, scaleY: 1, key: "",
      setPosition(x: number, y: number) {this.x = x; this.y = y; return this;},
      setOrigin(x: number, y: number) {this.originX = x; this.originY = y; return this;},
      setScale(x: number, y = x) {this.scaleX = x; this.scaleY = y; return this;},
      setVisible() {return this;},
      setDepth() {return this;},
      play(key: string) {this.key = key; return this;},
    };
    Object.assign(arena, {
      localAnimationSprite: sprite,
      hexGridToPixelCoords: () => ({x: 500, y: 500}),
      time: {delayedCall: (_delay: number, callback: () => void) => callback()},
      playSound() {},
      cameras: {main: {shake() {}}},
    });
    const cast = (spellId: number) => arena.processLocalAnimation({fromX: 0, fromY: 0, toX: 4, toY: 4, id: spellId, isKill: false});
    const playEffect = () => id === null ? arena.displayAttackImpact(4, 4) : cast(id);
    const placement = () => [sprite.x, sprite.y, sprite.originX, sprite.originY, sprite.scaleX, sprite.scaleY, sprite.key];

    playEffect();
    expect(sprite.originY).toBe(0.7);
    const initial = placement();
    for (const thunderId of [3, 4, 5]) {
      cast(thunderId);
      expect(sprite.originY).toBe(1);
      playEffect();
      expect(placement()).toEqual(initial);
    }
  });
}
