import {ControlBindings, comboFromEvent, resolveKeyAction} from "./bindings";

export const DESKTOP_ACTION_EVENT = "legion:desktop-action";
/** Fired when bindings or the keyboard layout change, so key hints can refresh. */
export const CONTROLS_CHANGED_EVENT = "legion:controls-changed";

type Slot = 1 | 2 | 3 | 4 | 5 | 6;
export type DesktopAction =
  | "menu-up" | "menu-down" | "menu-left" | "menu-right"
  | "confirm" | "cancel" | "previous-unit" | "next-unit"
  | "select-unit-1" | "select-unit-2" | "select-unit-3"
  | "end-turn" | "pause" | "abandon-dialog"
  | `item-${Slot}` | `spell-${Slot}`;

export type DesktopActionSource = "keyboard" | "gamepad";

export function actionFromKeyboard(
  event: Pick<KeyboardEvent, "code" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey">,
  inCombat = false,
  controls: ControlBindings = {},
): DesktopAction | null {
  return resolveKeyAction(comboFromEvent(event), inCombat, controls);
}

export function dispatchDesktopAction(action: DesktopAction, source: DesktopActionSource) {
  window.dispatchEvent(new CustomEvent(DESKTOP_ACTION_EVENT, {detail: {action, source}}));
}
