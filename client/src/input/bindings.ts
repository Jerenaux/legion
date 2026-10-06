import type {DesktopAction} from "./actions";

// Every remappable action, its context and its defaults. Keys are physical key codes
// (KeyboardEvent.code), so the same defaults suit QWERTY, AZERTY and other layouts;
// labels come from the player's actual layout. Buttons use the standard gamepad mapping.
export const ITEM_SLOTS = 6;
export const SPELL_SLOTS = 6;
/** Combined action-bar index where spells start; items occupy the indices below it. */
export const SPELL_SLOT_OFFSET = ITEM_SLOTS;

export type BindingContext = "combat" | "menu";
export interface BindingDefinition {
  action: DesktopAction;
  context: BindingContext;
  keys: string[];
  buttons: number[];
}

const ITEM_KEYS = ["KeyQ", "KeyW", "KeyE", "KeyR", "KeyT", "KeyY"];
const SPELL_KEYS = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN"];
const slot = (kind: "item" | "spell", keys: string[]) =>
  keys.map((key, index) => ({action: `${kind}-${index + 1}` as DesktopAction, context: "combat" as const, keys: [key], buttons: []}));

export const BINDINGS: BindingDefinition[] = [
  ...slot("item", ITEM_KEYS),
  ...slot("spell", SPELL_KEYS),
  {action: "end-turn", context: "combat", keys: ["Space", "End"], buttons: [3]},
  {action: "select-unit-1", context: "combat", keys: ["Digit1", "Numpad1"], buttons: []},
  {action: "select-unit-2", context: "combat", keys: ["Digit2", "Numpad2"], buttons: []},
  {action: "select-unit-3", context: "combat", keys: ["Digit3", "Numpad3"], buttons: []},
  {action: "next-unit", context: "combat", keys: ["Tab"], buttons: [5]},
  {action: "previous-unit", context: "combat", keys: ["Shift+Tab"], buttons: [4]},
  {action: "pause", context: "combat", keys: ["KeyP"], buttons: [9]},
  {action: "abandon-dialog", context: "combat", keys: ["Escape"], buttons: []},
  {action: "confirm", context: "menu", keys: ["Enter", "Space"], buttons: [0]},
  {action: "cancel", context: "menu", keys: ["Escape"], buttons: [1]},
  {action: "menu-up", context: "menu", keys: ["ArrowUp"], buttons: [12]},
  {action: "menu-down", context: "menu", keys: ["ArrowDown"], buttons: [13]},
  {action: "menu-left", context: "menu", keys: ["ArrowLeft"], buttons: [14]},
  {action: "menu-right", context: "menu", keys: ["ArrowRight"], buttons: [15]},
];

/** Up to two keys per action; one controller button. */
export const KEY_SLOTS = 2;

export interface ControlBindings {
  keys?: Partial<Record<DesktopAction, string[]>>;
  buttons?: Partial<Record<DesktopAction, number[]>>;
}

const definition = (action: DesktopAction) => BINDINGS.find(binding => binding.action === action);
export const keysFor = (action: DesktopAction, controls: ControlBindings = {}) =>
  controls.keys?.[action] ?? definition(action)?.keys ?? [];
export const buttonsFor = (action: DesktopAction, controls: ControlBindings = {}) =>
  controls.buttons?.[action] ?? definition(action)?.buttons ?? [];

const MODIFIER_CODES = new Set(["ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight", "AltLeft", "AltRight", "MetaLeft", "MetaRight"]);

/** "Shift+Tab", "KeyQ"…; null for a bare modifier press. */
export function comboFromEvent(event: Pick<KeyboardEvent, "code" | "shiftKey" | "ctrlKey" | "altKey" | "metaKey">) {
  if (!event.code || MODIFIER_CODES.has(event.code)) return null;
  return [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Meta", event.code]
    .filter(Boolean).join("+");
}

/** Combat bindings win during combat; menu bindings apply everywhere. */
export function resolveKeyAction(combo: string | null, inCombat: boolean, controls: ControlBindings = {}): DesktopAction | null {
  if (!combo) return null;
  const contexts: BindingContext[] = inCombat ? ["combat", "menu"] : ["menu"];
  for (const context of contexts) {
    const match = BINDINGS.find(binding => binding.context === context && keysFor(binding.action, controls).includes(combo));
    if (match) return match.action;
  }
  return null;
}

export function resolveButtonActions(pressed: number[], controls: ControlBindings = {}): DesktopAction[] {
  return BINDINGS.filter(binding => buttonsFor(binding.action, controls).some(button => pressed.includes(button)))
    .map(binding => binding.action);
}

/**
 * Bind a key to one of an action's slots. The same key is removed from any other action in
 * the same context, which is reported so the player can see what moved.
 */
export function assignKey(controls: ControlBindings, action: DesktopAction, slotIndex: number, combo: string | null) {
  const context = definition(action)?.context;
  const keys = {...controls.keys};
  let displaced: DesktopAction | null = null;
  if (combo) {
    for (const binding of BINDINGS) {
      if (binding.action === action || binding.context !== context) continue;
      const current = keysFor(binding.action, {keys});
      if (current.includes(combo)) {
        keys[binding.action] = current.filter(key => key !== combo);
        displaced = binding.action;
      }
    }
  }
  const own = [...keysFor(action, {keys})];
  if (combo) own[slotIndex] = combo; else own.splice(slotIndex, 1);
  keys[action] = own.filter((key, index) => key && own.indexOf(key) === index).slice(0, KEY_SLOTS);
  return {controls: {...controls, keys}, displaced};
}

/** A button drives one action at a time, across contexts, so a press is never ambiguous. */
export function assignButton(controls: ControlBindings, action: DesktopAction, button: number | null) {
  const buttons = {...controls.buttons};
  let displaced: DesktopAction | null = null;
  if (button !== null) {
    for (const binding of BINDINGS) {
      if (binding.action === action) continue;
      const current = buttonsFor(binding.action, {buttons});
      if (current.includes(button)) {
        buttons[binding.action] = current.filter(value => value !== button);
        displaced = binding.action;
      }
    }
  }
  buttons[action] = button === null ? [] : [button];
  return {controls: {...controls, buttons}, displaced};
}

export function parseControlBindings(raw: unknown): ControlBindings {
  if (!raw || typeof raw !== "object") return {};
  const known = new Set(BINDINGS.map(binding => binding.action as string));
  const pick = <T,>(value: unknown, valid: (entry: unknown) => entry is T) => Object.fromEntries(
    Object.entries(value && typeof value === "object" ? value : {})
      .filter(([action, list]) => known.has(action) && Array.isArray(list))
      .map(([action, list]) => [action, (list as unknown[]).filter(valid)]),
  );
  const {keys, buttons} = raw as ControlBindings;
  return {
    keys: pick(keys, (key): key is string => typeof key === "string" && /^[A-Za-z0-9+]{1,40}$/.test(key)),
    buttons: pick(buttons, (button): button is number => Number.isInteger(button) && (button as number) >= 0 && (button as number) < 32),
  };
}

// Labels: the character printed on the player's key when the browser can tell us.
let layoutMap: Map<string, string> | null = null;
export async function loadKeyboardLayout() {
  try {
    const keyboard = (navigator as Navigator & {keyboard?: {getLayoutMap?: () => Promise<Map<string, string>>}}).keyboard;
    layoutMap = (await keyboard?.getLayoutMap?.()) ?? null;
  } catch {
    layoutMap = null;
  }
}

const SPECIAL_KEYS: Record<string, string> = {
  Space: "Space", Escape: "Esc", Enter: "Enter", Tab: "Tab", Backspace: "Backspace", End: "End", Home: "Home",
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", PageUp: "PgUp", PageDown: "PgDn", Delete: "Del", Insert: "Ins",
};

export function keyLabel(combo: string, translate: (text: string) => string = text => text) {
  const parts = combo.split("+");
  const code = parts.pop() as string;
  const mapped = layoutMap?.get(code);
  const base = SPECIAL_KEYS[code] ? translate(SPECIAL_KEYS[code])
    : mapped && mapped.trim() ? mapped.toUpperCase()
    : code.replace(/^Key/, "").replace(/^Digit/, "").replace(/^Numpad/, "Num ");
  return [...parts.map(part => translate(part)), base].join(" + ");
}

const XBOX_BUTTONS = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "View", "Menu", "LS", "RS", "D-pad ↑", "D-pad ↓", "D-pad ←", "D-pad →"];
const PLAYSTATION_BUTTONS = ["✕", "○", "□", "△", "L1", "R1", "L2", "R2", "Create", "Options", "L3", "R3", "D-pad ↑", "D-pad ↓", "D-pad ←", "D-pad →"];
export function buttonLabel(button: number, family: "xbox" | "playstation" = "xbox") {
  return (family === "playstation" ? PLAYSTATION_BUTTONS : XBOX_BUTTONS)[button] ?? `#${button + 1}`;
}

/** First key label for an action, for the hints printed on action-bar icons. */
export function primaryKeyLabel(action: DesktopAction, controls: ControlBindings = {}) {
  const [key] = keysFor(action, controls);
  return key ? keyLabel(key) : "";
}
