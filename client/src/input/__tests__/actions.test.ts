import {actionFromKeyboard} from "../actions";
import {gamepadActions, pollGamepads} from "../gamepad";

const keyboard = (code: string, shiftKey = false) => ({code, key: code, shiftKey});
const gamepad = (pressed: number[] = [], axes = [0, 0]) => ({
  index: 0,
  buttons: Array.from({length: 16}, (_, index) => ({pressed: pressed.includes(index)})) as GamepadButton[],
  axes,
});

test("maps desktop gameplay and menu actions", () => {
  expect(actionFromKeyboard(keyboard("ArrowDown"))).toBe("menu-down");
  expect(actionFromKeyboard(keyboard("Digit2"))).toBe("select-unit-2");
  expect(actionFromKeyboard(keyboard("Tab", true))).toBe("previous-unit");
  expect(actionFromKeyboard(keyboard("KeyE"))).toBe("end-turn");
  expect(gamepadActions(gamepad([0, 5, 9]) as any)).toEqual(["confirm", "next-unit", "pause"]);
  expect(gamepadActions(gamepad([], [-1, 1]) as any)).toEqual(["menu-left", "menu-down"]);
});

test("emits button edges again after a controller disconnects", () => {
  const first = pollGamepads([gamepad([0]) as any]);
  expect(first.actions).toEqual(["confirm"]);
  expect(pollGamepads([gamepad([0]) as any], first.pressed).actions).toEqual([]);
  const disconnected = pollGamepads([null], first.pressed);
  expect(pollGamepads([gamepad([0]) as any], disconnected.pressed).actions).toEqual(["confirm"]);
});
