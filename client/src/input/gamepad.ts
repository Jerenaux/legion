import { DesktopAction } from "./actions";

const BUTTON_ACTIONS: Record<number, DesktopAction> = {
  0: "confirm",
  1: "cancel",
  3: "end-turn",
  4: "previous-unit",
  5: "next-unit",
  9: "pause",
  12: "menu-up",
  13: "menu-down",
  14: "menu-left",
  15: "menu-right",
};

type GamepadLike = Pick<Gamepad, "index" | "buttons" | "axes">;

export function gamepadActions(gamepad: GamepadLike): DesktopAction[] {
  const actions = Object.entries(BUTTON_ACTIONS)
    .filter(([button]) => gamepad.buttons[Number(button)]?.pressed)
    .map(([, action]) => action);
  const [x = 0, y = 0] = gamepad.axes;
  if (x < -0.6) actions.push("menu-left");
  if (x > 0.6) actions.push("menu-right");
  if (y < -0.6) actions.push("menu-up");
  if (y > 0.6) actions.push("menu-down");
  return [...new Set(actions)];
}

export function pollGamepads(gamepads: ArrayLike<GamepadLike | null>, previous = new Set<string>()) {
  const pressed = new Set<string>();
  const actions: DesktopAction[] = [];
  Array.from(gamepads).forEach((gamepad) => {
    if (!gamepad) return;
    gamepadActions(gamepad).forEach((action) => {
      const key = `${gamepad.index}:${action}`;
      pressed.add(key);
      if (!previous.has(key)) actions.push(action);
    });
  });
  return { actions, pressed };
}

export function startGamepadInput(onAction: (action: DesktopAction) => void) {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return () => undefined;
  let previous = new Set<string>();
  let frame = 0;
  let running = true;
  const poll = () => {
    const next = pollGamepads(navigator.getGamepads(), previous);
    previous = next.pressed;
    next.actions.forEach(onAction);
    if (running) frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);
  return () => {
    running = false;
    cancelAnimationFrame(frame);
  };
}
