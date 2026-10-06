import { test, expect } from 'bun:test';
import {actionFromKeyboard} from "../actions";
import {gamepadActions, pollGamepads} from "../gamepad";
import {assignButton, assignKey, keysFor, parseControlBindings, resolveKeyAction} from "../bindings";

const keyboard = (code: string, shiftKey = false) => ({code, shiftKey, ctrlKey: false, altKey: false, metaKey: false});
const gamepad = (pressed: number[] = [], axes = [0, 0]) => ({
  index: 0,
  buttons: Array.from({length: 16}, (_, index) => ({pressed: pressed.includes(index)})) as GamepadButton[],
  axes,
});

test("maps desktop gameplay and menu actions", () => {
  expect(actionFromKeyboard(keyboard("ArrowDown"))).toBe("menu-down");
  expect(actionFromKeyboard(keyboard("Digit2"), true)).toBe("select-unit-2");
  expect(actionFromKeyboard(keyboard("Tab", true), true)).toBe("previous-unit");
  expect(actionFromKeyboard(keyboard("End"), true)).toBe("end-turn");
  expect(gamepadActions(gamepad([0, 5, 9]) as unknown as Gamepad)).toEqual(["next-unit", "pause", "confirm"]);
  expect(gamepadActions(gamepad([], [-1, 1]) as unknown as Gamepad)).toEqual(["menu-left", "menu-down"]);
});

test("action slots use physical keys, so item 3 is never also Pass Turn", () => {
  expect(actionFromKeyboard(keyboard("KeyQ"), true)).toBe("item-1");
  expect(actionFromKeyboard(keyboard("KeyE"), true)).toBe("item-3");
  expect(actionFromKeyboard(keyboard("KeyZ"), true)).toBe("spell-1");
  expect(actionFromKeyboard(keyboard("KeyQ"))).toBeNull();
});

test("emits button edges again after a controller disconnects", () => {
  const first = pollGamepads([gamepad([0]) as unknown as Gamepad]);
  expect(first.actions).toEqual(["confirm"]);
  expect(pollGamepads([gamepad([0]) as unknown as Gamepad], first.pressed).actions).toEqual([]);
  const disconnected = pollGamepads([null], first.pressed);
  expect(pollGamepads([gamepad([0]) as unknown as Gamepad], disconnected.pressed).actions).toEqual(["confirm"]);
});

test("Space and Escape use combat shortcuts only outside menus and dialogs", () => {
  expect(actionFromKeyboard(keyboard("Space"), true)).toBe("end-turn");
  expect(actionFromKeyboard(keyboard("Escape"), true)).toBe("abandon-dialog");
  expect(actionFromKeyboard(keyboard("Space"))).toBe("confirm");
  expect(actionFromKeyboard(keyboard("Escape"))).toBe("cancel");
});

test("rebinding a key moves it away from the action that had it", () => {
  const {controls, displaced} = assignKey({}, "end-turn", 0, "KeyQ");
  expect(displaced).toBe("item-1");
  expect(resolveKeyAction("KeyQ", true, controls)).toBe("end-turn");
  expect(keysFor("item-1", controls)).toEqual([]);
  expect(keysFor("end-turn", controls)).toEqual(["KeyQ", "End"]);
  // A menu key may match a combat key: combat wins only while no menu or dialog is open.
  expect(assignKey({}, "item-1", 0, "Enter").displaced).toBeNull();
  const cleared = assignKey(controls, "end-turn", 1, null).controls;
  expect(keysFor("end-turn", cleared)).toEqual(["KeyQ"]);
});

test("controller buttons are remappable, including the D-pad, while the stick still navigates", () => {
  const {controls, displaced} = assignButton({}, "select-unit-1", 12);
  expect(displaced).toBe("menu-up");
  expect(gamepadActions(gamepad([12]) as unknown as Gamepad, controls)).toEqual(["select-unit-1"]);
  expect(gamepadActions(gamepad([], [0, -1]) as unknown as Gamepad, controls)).toEqual(["menu-up"]);
});

test("saved bindings ignore unknown actions and malformed values", () => {
  expect(parseControlBindings({keys: {"item-1": ["KeyA", 5, "<script>"], hack: ["KeyB"]}, buttons: {"end-turn": [2, -1, "x"]}}))
    .toEqual({keys: {"item-1": ["KeyA"]}, buttons: {"end-turn": [2]}});
  expect(parseControlBindings("nonsense")).toEqual({});
});
