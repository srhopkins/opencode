// Pure keybinding logic for PTT (push-to-talk): capture, serialize/parse, match,
// and describe a single key combo. Deliberately separate from the app's
// command-palette keybind system (@/context/command) — that system persists
// overrides through the app's settings store, but PTT's binding needs to live
// in murfy-voice's own `murfy.voice.pttKey` localStorage key (see
// ptt-key-setting.ts) so it stays self-contained and simple to inspect/change
// even without opening Settings. The matching/gating semantics below mirror
// @/context/command's `normalizeKey`/`matchKeybind`/editable-target gating so
// PTT behaves consistently with the rest of the app's shortcuts.
export interface KeyBinding {
  key: string
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
}

export const DEFAULT_PTT_KEYBINDING: KeyBinding = {
  key: "space",
  ctrl: true,
  meta: false,
  alt: false,
  shift: false,
}

const MODIFIER_KEYS = new Set(["Control", "Meta", "Alt", "Shift"])

function normalizeKey(key: string): string {
  if (key === " ") return "space"
  if (key === ",") return "comma"
  if (key === "+") return "plus"
  return key.toLowerCase()
}

/** F1-F24: physical macro keys / PTT buttons commonly emit these, and normal typing
 * essentially never produces them, so they're safe to intercept globally. */
export function isFunctionKey(key: string): boolean {
  return /^f([1-9]|1\d|2[0-4])$/.test(key)
}

/** A binding is safe to intercept even while an input/textarea/contenteditable is
 * focused when it either requires a modifier (so it can't collide with normal typing)
 * or is a bare function key (never produced by typing). Anything else (e.g. a plain
 * letter key with no modifier) must NOT fire while the user is typing in an editable
 * element. */
export function isSafeWhileEditing(binding: KeyBinding): boolean {
  return binding.ctrl || binding.meta || binding.alt || isFunctionKey(binding.key)
}

type KeyEventLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }

/** Extracts a KeyBinding from a keydown event. Returns undefined for a bare modifier
 * press (Control/Meta/Alt/Shift alone) so callers capturing a new binding can keep
 * waiting for the key that completes the chord. */
export function keyBindingFromEvent(event: KeyEventLike): KeyBinding | undefined {
  if (MODIFIER_KEYS.has(event.key)) return undefined
  const key = normalizeKey(event.key)
  if (!key) return undefined
  return { key, ctrl: event.ctrlKey, meta: event.metaKey, alt: event.altKey, shift: event.shiftKey }
}

export function matchesKeyBinding(event: KeyEventLike, binding: KeyBinding): boolean {
  return (
    normalizeKey(event.key) === binding.key &&
    event.ctrlKey === binding.ctrl &&
    event.metaKey === binding.meta &&
    event.altKey === binding.alt &&
    event.shiftKey === binding.shift
  )
}

export function serializeKeyBinding(binding: KeyBinding): string {
  const parts: string[] = []
  if (binding.ctrl) parts.push("ctrl")
  if (binding.meta) parts.push("meta")
  if (binding.alt) parts.push("alt")
  if (binding.shift) parts.push("shift")
  parts.push(binding.key)
  return parts.join("+")
}

export function parseKeyBinding(value: string | null | undefined): KeyBinding | undefined {
  if (!value) return undefined
  const parts = value
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  if (parts.length === 0) return undefined

  const binding: KeyBinding = { key: "", ctrl: false, meta: false, alt: false, shift: false }
  for (const part of parts) {
    switch (part) {
      case "ctrl":
      case "control":
        binding.ctrl = true
        break
      case "meta":
      case "cmd":
      case "command":
        binding.meta = true
        break
      case "alt":
      case "option":
        binding.alt = true
        break
      case "shift":
        binding.shift = true
        break
      default:
        binding.key = part
    }
  }
  if (!binding.key) return undefined
  return binding
}

const DISPLAY_KEYS: Record<string, string> = {
  space: "Space",
  comma: ",",
  plus: "+",
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  escape: "Esc",
  enter: "Enter",
  tab: "Tab",
}

function displayKey(key: string): string {
  if (DISPLAY_KEYS[key]) return DISPLAY_KEYS[key]
  if (isFunctionKey(key)) return key.toUpperCase()
  if (key.length === 1) return key.toUpperCase()
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function describeKeyBinding(binding: KeyBinding): string {
  const parts: string[] = []
  if (binding.ctrl) parts.push("Ctrl")
  if (binding.alt) parts.push("Alt")
  if (binding.shift) parts.push("Shift")
  if (binding.meta) parts.push("Cmd")
  parts.push(displayKey(binding.key))
  return parts.join("+")
}
