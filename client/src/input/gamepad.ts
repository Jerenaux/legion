import {DesktopAction} from "./actions";
import {ControlBindings, resolveButtonActions} from "./bindings";

type GamepadLike = Pick<Gamepad, "index" | "buttons" | "axes">;

const pressedButtons = (gamepad: GamepadLike) =>
  Array.from(gamepad.buttons, (button, index) => (button?.pressed ? index : -1)).filter(index => index >= 0);

// The left stick always moves focus, so the D-pad can carry other actions.
export function gamepadActions(gamepad: GamepadLike, controls: ControlBindings = {}): DesktopAction[] {
  const actions = resolveButtonActions(pressedButtons(gamepad), controls);
  const [x = 0, y = 0] = gamepad.axes;
  if (x < -0.6) actions.push("menu-left");
  if (x > 0.6) actions.push("menu-right");
  if (y < -0.6) actions.push("menu-up");
  if (y > 0.6) actions.push("menu-down");
  return [...new Set(actions)];
}

export function pollGamepads(gamepads: ArrayLike<GamepadLike | null>, previous = new Set<string>(), controls: ControlBindings = {}) {
  const pressed = new Set<string>();
  const actions: DesktopAction[] = [];
  const newButtons: number[] = [];
  Array.from(gamepads).forEach(gamepad => {
    if (!gamepad) return;
    pressedButtons(gamepad).forEach(button => {
      const key = `${gamepad.index}:button:${button}`;
      pressed.add(key);
      if (!previous.has(key)) newButtons.push(button);
    });
    gamepadActions(gamepad, controls).forEach(action => {
      const key = `${gamepad.index}:${action}`;
      pressed.add(key);
      if (!previous.has(key)) actions.push(action);
    });
  });
  return {actions, pressed, newButtons};
}

// While rebinding, the next new button press goes to the settings screen instead of the game.
let captureButton: ((button: number) => void) | null = null;
export function captureNextButton(onButton: ((button: number) => void) | null) {
  captureButton = onButton;
}

export function startGamepadInput(onAction: (action: DesktopAction) => void, getControls: () => ControlBindings = () => ({})) {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return () => undefined;
  let previous = new Set<string>();
  let frame = 0;
  let running = true;
  const poll = () => {
    const next = pollGamepads(navigator.getGamepads(), previous, getControls());
    previous = next.pressed;
    if (captureButton) {
      if (next.newButtons.length) {
        const deliver = captureButton;
        captureButton = null;
        deliver(next.newButtons[0]);
      }
    } else {
      next.actions.forEach(onAction);
    }
    if (running) frame = requestAnimationFrame(poll);
  };
  frame = requestAnimationFrame(poll);
  return () => {
    running = false;
    cancelAnimationFrame(frame);
  };
}
