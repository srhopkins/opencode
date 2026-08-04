// Persistence for murfy voice toggle state. Plain localStorage (not the app's
// heavier `Persist`/`persisted()` machinery in `@/utils/persist`, which is built
// around solid-js stores + desktop storage scopes) — these are simple booleans
// global to the browser, so a direct `murfy.*` key is more surgical and matches
// the pattern already used by the reference voice-page (`murfy.<key>` in
// localStorage, see github/srhopkins/murfy/voice-page/src/config.ts).
import { createSignal, onCleanup, type Accessor, type Setter } from "solid-js"

const AUTO_READ_KEY = "murfy.voice.autoRead"

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return raw === "true"
  } catch {
    return fallback
  }
}

function writeBoolean(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "true" : "false")
  } catch {
    // best-effort; ignore quota/availability errors
  }
}

/**
 * Reactive boolean persisted to localStorage under `murfy.*`, synced across
 * tabs/windows via the `storage` event. Reusable for future voice toggles
 * (PTT mode, voice-loop) — not specific to auto-read.
 */
export function createPersistedVoiceToggle(key: string, fallback = false): [Accessor<boolean>, Setter<boolean>] {
  const [value, setValue] = createSignal(readBoolean(key, fallback))

  const setAndPersist: Setter<boolean> = ((next: boolean | ((prev: boolean) => boolean)) => {
    const resolved = setValue((prev) => (typeof next === "function" ? (next as (prev: boolean) => boolean)(prev) : next))
    writeBoolean(key, resolved)
    return resolved
  }) as Setter<boolean>

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return
    setValue(readBoolean(key, fallback))
  }
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage)
    onCleanup(() => window.removeEventListener("storage", onStorage))
  }

  return [value, setAndPersist]
}

export function createAutoReadSetting() {
  return createPersistedVoiceToggle(AUTO_READ_KEY, false)
}
