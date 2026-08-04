import { describe, expect, test } from "bun:test"
import {
  DEFAULT_PTT_KEYBINDING,
  describeKeyBinding,
  isFunctionKey,
  isSafeWhileEditing,
  keyBindingFromEvent,
  matchesKeyBinding,
  parseKeyBinding,
  serializeKeyBinding,
  type KeyBinding,
} from "./keybinding"

type TestKeyEvent = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }

const event = (overrides: Partial<TestKeyEvent> = {}): TestKeyEvent => ({
  key: "a",
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
})

describe("keyBindingFromEvent", () => {
  test("captures a plain key with no modifiers", () => {
    expect(keyBindingFromEvent(event({ key: "j" }))).toEqual({
      key: "j",
      ctrl: false,
      meta: false,
      alt: false,
      shift: false,
    })
  })

  test("captures modifier + key combos", () => {
    expect(keyBindingFromEvent(event({ key: " ", ctrlKey: true }))).toEqual({
      key: "space",
      ctrl: true,
      meta: false,
      alt: false,
      shift: false,
    })
  })

  test("captures bare function keys", () => {
    expect(keyBindingFromEvent(event({ key: "F13" }))).toEqual({
      key: "f13",
      ctrl: false,
      meta: false,
      alt: false,
      shift: false,
    })
  })

  test("ignores a bare modifier press, waiting for the completing key", () => {
    expect(keyBindingFromEvent(event({ key: "Control", ctrlKey: true }))).toBeUndefined()
    expect(keyBindingFromEvent(event({ key: "Shift", shiftKey: true }))).toBeUndefined()
    expect(keyBindingFromEvent(event({ key: "Meta", metaKey: true }))).toBeUndefined()
    expect(keyBindingFromEvent(event({ key: "Alt", altKey: true }))).toBeUndefined()
  })
})

describe("serializeKeyBinding / parseKeyBinding round trip", () => {
  test("round-trips the default binding", () => {
    const serialized = serializeKeyBinding(DEFAULT_PTT_KEYBINDING)
    expect(parseKeyBinding(serialized)).toEqual(DEFAULT_PTT_KEYBINDING)
  })

  test("round-trips a bare function key with no modifiers", () => {
    const binding: KeyBinding = { key: "f13", ctrl: false, meta: false, alt: false, shift: false }
    expect(parseKeyBinding(serializeKeyBinding(binding))).toEqual(binding)
  })

  test("round-trips a combo with every modifier held", () => {
    const binding: KeyBinding = { key: "j", ctrl: true, meta: true, alt: true, shift: true }
    expect(parseKeyBinding(serializeKeyBinding(binding))).toEqual(binding)
  })

  test("parseKeyBinding returns undefined for empty/missing input", () => {
    expect(parseKeyBinding(undefined)).toBeUndefined()
    expect(parseKeyBinding(null)).toBeUndefined()
    expect(parseKeyBinding("")).toBeUndefined()
  })

  test("parseKeyBinding returns undefined when only modifiers are present (no key)", () => {
    expect(parseKeyBinding("ctrl+meta")).toBeUndefined()
  })

  test("parseKeyBinding is case-insensitive", () => {
    expect(parseKeyBinding("CTRL+Space")).toEqual({ key: "space", ctrl: true, meta: false, alt: false, shift: false })
  })
})

describe("matchesKeyBinding", () => {
  test("matches when key and all modifiers align exactly", () => {
    expect(matchesKeyBinding(event({ key: " ", ctrlKey: true }), DEFAULT_PTT_KEYBINDING)).toBe(true)
  })

  test("does not match when an extra modifier is held", () => {
    expect(matchesKeyBinding(event({ key: " ", ctrlKey: true, shiftKey: true }), DEFAULT_PTT_KEYBINDING)).toBe(false)
  })

  test("does not match a different key", () => {
    expect(matchesKeyBinding(event({ key: "b", ctrlKey: true }), DEFAULT_PTT_KEYBINDING)).toBe(false)
  })
})

describe("isFunctionKey", () => {
  test("accepts F1 through F24", () => {
    expect(isFunctionKey("f1")).toBe(true)
    expect(isFunctionKey("f9")).toBe(true)
    expect(isFunctionKey("f13")).toBe(true)
    expect(isFunctionKey("f24")).toBe(true)
  })

  test("rejects out-of-range or non-function keys", () => {
    expect(isFunctionKey("f25")).toBe(false)
    expect(isFunctionKey("space")).toBe(false)
    expect(isFunctionKey("j")).toBe(false)
  })
})

describe("isSafeWhileEditing", () => {
  test("a bare letter key is not safe while editing", () => {
    expect(isSafeWhileEditing({ key: "j", ctrl: false, meta: false, alt: false, shift: false })).toBe(false)
  })

  test("any modifier makes a binding safe while editing", () => {
    expect(isSafeWhileEditing({ key: "j", ctrl: true, meta: false, alt: false, shift: false })).toBe(true)
    expect(isSafeWhileEditing({ key: "j", ctrl: false, meta: true, alt: false, shift: false })).toBe(true)
    expect(isSafeWhileEditing({ key: "j", ctrl: false, meta: false, alt: true, shift: false })).toBe(true)
  })

  test("shift alone does not make a binding safe (still produces printable text)", () => {
    expect(isSafeWhileEditing({ key: "j", ctrl: false, meta: false, alt: false, shift: true })).toBe(false)
  })

  test("a bare function key is safe while editing", () => {
    expect(isSafeWhileEditing({ key: "f13", ctrl: false, meta: false, alt: false, shift: false })).toBe(true)
  })

  test("the default PTT binding is safe while editing", () => {
    expect(isSafeWhileEditing(DEFAULT_PTT_KEYBINDING)).toBe(true)
  })
})

describe("describeKeyBinding", () => {
  test("describes the default binding", () => {
    expect(describeKeyBinding(DEFAULT_PTT_KEYBINDING)).toBe("Ctrl+Space")
  })

  test("describes a bare function key", () => {
    expect(describeKeyBinding({ key: "f13", ctrl: false, meta: false, alt: false, shift: false })).toBe("F13")
  })

  test("describes a full modifier combo in a stable order", () => {
    expect(describeKeyBinding({ key: "j", ctrl: true, meta: true, alt: true, shift: true })).toBe(
      "Ctrl+Alt+Shift+Cmd+J",
    )
  })
})
