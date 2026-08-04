// Persistence for the PTT keybinding, following the same surgical `murfy.*`
// localStorage pattern as settings.ts (see that file's header comment for why
// this bypasses the app's heavier Persist/persisted() machinery). Reassignable
// at runtime by Steve's physical PTT button or from the composer's "set key"
// affordance — see use-ptt.ts.
import { createSignal, onCleanup, type Accessor, type Setter } from "solid-js"
import { DEFAULT_PTT_KEYBINDING, parseKeyBinding, serializeKeyBinding, type KeyBinding } from "./keybinding"

const PTT_KEY_STORAGE_KEY = "murfy.voice.pttKey"

function readPttKeyBinding(): KeyBinding {
  try {
    return parseKeyBinding(localStorage.getItem(PTT_KEY_STORAGE_KEY)) ?? DEFAULT_PTT_KEYBINDING
  } catch {
    return DEFAULT_PTT_KEYBINDING
  }
}

function writePttKeyBinding(binding: KeyBinding) {
  try {
    localStorage.setItem(PTT_KEY_STORAGE_KEY, serializeKeyBinding(binding))
  } catch {
    // best-effort; ignore quota/availability errors
  }
}

export function createPttKeyBindingSetting(): [Accessor<KeyBinding>, Setter<KeyBinding>] {
  const [value, setValue] = createSignal<KeyBinding>(readPttKeyBinding())

  const setAndPersist: Setter<KeyBinding> = ((next: KeyBinding | ((prev: KeyBinding) => KeyBinding)) => {
    const resolved = setValue((prev) => (typeof next === "function" ? (next as (prev: KeyBinding) => KeyBinding)(prev) : next))
    writePttKeyBinding(resolved)
    return resolved
  }) as Setter<KeyBinding>

  const onStorage = (event: StorageEvent) => {
    if (event.key !== PTT_KEY_STORAGE_KEY) return
    setValue(readPttKeyBinding())
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage)
    onCleanup(() => window.removeEventListener("storage", onStorage))
  }

  return [value, setAndPersist]
}
