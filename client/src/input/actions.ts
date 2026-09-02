export const DESKTOP_ACTION_EVENT = "legion:desktop-action";

export type DesktopAction =
  | "menu-up" | "menu-down" | "menu-left" | "menu-right"
  | "confirm" | "cancel" | "previous-unit" | "next-unit"
  | "select-unit-1" | "select-unit-2" | "select-unit-3"
  | "end-turn" | "pause";

export type DesktopActionSource = "keyboard" | "gamepad";

export function actionFromKeyboard(event: Pick<KeyboardEvent, "code" | "key" | "shiftKey">): DesktopAction | null {
  const byCode: Record<string, DesktopAction> = {
    ArrowUp: "menu-up",
    ArrowDown: "menu-down",
    ArrowLeft: "menu-left",
    ArrowRight: "menu-right",
    Enter: "confirm",
    Space: "confirm",
    Escape: "cancel",
    Digit1: "select-unit-1",
    Digit2: "select-unit-2",
    Digit3: "select-unit-3",
    KeyE: "end-turn",
    End: "end-turn",
    KeyP: "pause",
  };
  if (event.code === "Tab") return event.shiftKey ? "previous-unit" : "next-unit";
  return byCode[event.code] || byCode[event.key] || null;
}

export function dispatchDesktopAction(action: DesktopAction, source: DesktopActionSource) {
  window.dispatchEvent(new CustomEvent(DESKTOP_ACTION_EVENT, {detail: {action, source}}));
}
