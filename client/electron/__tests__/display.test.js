const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {readDisplayMode, writeDisplayMode, isFullscreenShortcut} = require("../display");

const directory = () => fs.mkdtempSync(path.join(os.tmpdir(), "legion-display-"));

test("opens fullscreen on first launch and after a corrupt save", () => {
  const dir = directory();
  expect(readDisplayMode(dir)).toEqual({fullscreen: true});
  fs.writeFileSync(path.join(dir, "display.json"), "{not json");
  expect(readDisplayMode(dir)).toEqual({fullscreen: true});
});

test("remembers the player's choice between launches", () => {
  const dir = directory();
  writeDisplayMode(dir, {fullscreen: false});
  expect(readDisplayMode(dir)).toEqual({fullscreen: false});
  writeDisplayMode(dir, {fullscreen: true});
  expect(readDisplayMode(dir)).toEqual({fullscreen: true});
});

test("an unwritable profile does not throw", () => {
  const file = path.join(directory(), "blocker");
  fs.writeFileSync(file, "");
  expect(() => writeDisplayMode(path.join(file, "nested"), {fullscreen: false})).not.toThrow();
});

test("toggles with the platform's fullscreen shortcut, never Escape", () => {
  const key = (key, extra = {}) => ({type: "keyDown", key, ...extra});
  expect(isFullscreenShortcut(key("F11"), "win32")).toBe(true);
  expect(isFullscreenShortcut(key("Enter", {alt: true}), "win32")).toBe(true);
  expect(isFullscreenShortcut(key("Enter"), "win32")).toBe(false);
  expect(isFullscreenShortcut(key("f", {control: true, meta: true}), "darwin")).toBe(true);
  expect(isFullscreenShortcut(key("F11"), "darwin")).toBe(false);
  expect(isFullscreenShortcut(key("F11", {isAutoRepeat: true}), "win32")).toBe(false);
  expect(isFullscreenShortcut({type: "keyUp", key: "F11"}, "win32")).toBe(false);
  for (const platform of ["win32", "darwin", "linux"]) expect(isFullscreenShortcut(key("Escape"), platform)).toBe(false);
});
