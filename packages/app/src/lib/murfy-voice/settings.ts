// Persistence for murfy voice toggle/number state. Plain localStorage (not the app's
// heavier `Persist`/`persisted()` machinery in `@/utils/persist`, which is built
// around solid-js stores + desktop storage scopes) — these are simple values
// global to the browser, so a direct `murfy.*` key is more surgical and matches
// the pattern already used by the reference voice-page (`murfy.<key>` in
// localStorage, see github/srhopkins/murfy/voice-page/src/config.ts).
import { createSignal, onCleanup, type Accessor, type Setter } from "solid-js"

const AUTO_READ_KEY = "murfy.voice.autoRead"
const TTS_SPEED_KEY = "murfy.voice.ttsSpeed"
const SENTENCE_GAP_MS_KEY = "murfy.voice.sentenceGapMs"
const COMMA_GAP_MS_KEY = "murfy.voice.commaGapMs"
const COMMA_SPLIT_MIN_WORDS_KEY = "murfy.voice.commaSplitMinWords"

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

function readNumber(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  } catch {
    return fallback
  }
}

function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value))
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

/**
 * Reactive number persisted to localStorage under `murfy.*`, synced across
 * tabs/windows via the `storage` event. Used for TTS speed and gap timings.
 */
export function createPersistedVoiceNumber(key: string, fallback: number): [Accessor<number>, Setter<number>] {
  const [value, setValue] = createSignal(readNumber(key, fallback))

  const setAndPersist: Setter<number> = ((next: number | ((prev: number) => number)) => {
    const resolved = setValue((prev) => (typeof next === "function" ? (next as (prev: number) => number)(prev) : next))
    writeNumber(key, resolved)
    return resolved
  }) as Setter<number>

  const onStorage = (event: StorageEvent) => {
    if (event.key !== key) return
    setValue(readNumber(key, fallback))
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

export function createTtsSpeedSetting() {
  return createPersistedVoiceNumber(TTS_SPEED_KEY, 1)
}

export function createSentenceGapMsSetting() {
  return createPersistedVoiceNumber(SENTENCE_GAP_MS_KEY, 450)
}

export function createCommaGapMsSetting() {
  return createPersistedVoiceNumber(COMMA_GAP_MS_KEY, 250)
}

export function createCommaSplitMinWordsSetting() {
  return createPersistedVoiceNumber(COMMA_SPLIT_MIN_WORDS_KEY, 6)
}
