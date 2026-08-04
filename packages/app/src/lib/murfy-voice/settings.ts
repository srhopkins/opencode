// Persistence for murfy voice toggle/number state. Plain localStorage (not the app's
// heavier `Persist`/`persisted()` machinery in `@/utils/persist`, which is built
// around solid-js stores + desktop storage scopes) — these are simple values
// global to the browser, so a direct `murfy.*` key is more surgical and matches
// the pattern already used by the reference voice-page (`murfy.<key>` in
// localStorage, see github/srhopkins/murfy/voice-page/src/config.ts).
import { createSignal, onCleanup, type Accessor, type Setter } from "solid-js"
import { DEFAULT_VAD_GATE_CONFIG, type VadGateConfig } from "./vad-gate"

const AUTO_READ_KEY = "murfy.voice.autoRead"
const TTS_SPEED_KEY = "murfy.voice.ttsSpeed"
const SENTENCE_GAP_MS_KEY = "murfy.voice.sentenceGapMs"
const COMMA_GAP_MS_KEY = "murfy.voice.commaGapMs"
const COMMA_SPLIT_MIN_WORDS_KEY = "murfy.voice.commaSplitMinWords"
const VOICE_MODE_KEY = "murfy.voice.mode"
const VAD_START_MULT_KEY = "murfy.voice.vad.startMult"
const VAD_STOP_MULT_KEY = "murfy.voice.vad.stopMult"
const VAD_START_FLOOR_MIN_KEY = "murfy.voice.vad.startFloorMin"
const VAD_STOP_FLOOR_MIN_KEY = "murfy.voice.vad.stopFloorMin"
const VAD_START_MS_KEY = "murfy.voice.vad.startMs"
const VAD_STOP_MS_KEY = "murfy.voice.vad.stopMs"
const VAD_MIN_SPEECH_MS_KEY = "murfy.voice.vad.minSpeechMs"
const VAD_PREROLL_MS_KEY = "murfy.voice.vad.prerollMs"

export type VoiceMode = "ptt" | "vad"

// Multiple independent consumers now read/write the same logical setting within
// one tab (e.g. the gear popover's sliders and auto-read's SpeechQueue both need
// live sentenceGapMs/commaGapMs/ttsSpeed; the bar toggle and the gear popover's
// default-mode select both need live voice.mode). The `storage` event these
// factories already listen to only fires *cross-tab* — a same-tab caller would
// never see another same-tab caller's update without sharing one signal. A tiny
// per-key singleton cache keeps every call to e.g. createSentenceGapMsSetting()
// return the SAME live signal/setter pair, independent of call site or order.
const registry = new Map<string, unknown>()

function getOrCreate<T>(key: string, factory: () => [Accessor<T>, Setter<T>]): [Accessor<T>, Setter<T>] {
  const existing = registry.get(key)
  if (existing) return existing as [Accessor<T>, Setter<T>]
  const created = factory()
  registry.set(key, created)
  return created
}

/** Test-only: clears the singleton cache so each test starts from a fresh signal
 * bound to the current localStorage state, instead of a stale signal left over
 * from an earlier test that happened to touch the same key. */
export function __resetVoiceSettingsRegistryForTests() {
  registry.clear()
}

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
  return getOrCreate(key, () => {
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
  })
}

/**
 * Reactive number persisted to localStorage under `murfy.*`, synced across
 * tabs/windows via the `storage` event. Used for TTS speed and gap timings.
 */
export function createPersistedVoiceNumber(key: string, fallback: number): [Accessor<number>, Setter<number>] {
  return getOrCreate(key, () => {
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
  })
}

function readString(key: string, fallback: string): string {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : raw
  } catch {
    return fallback
  }
}

function writeString(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // best-effort; ignore quota/availability errors
  }
}

/**
 * Reactive string persisted to localStorage under `murfy.*`, synced across
 * tabs/windows via the `storage` event. Used for `murfy.voice.mode`.
 */
export function createPersistedVoiceString<T extends string>(key: string, fallback: T): [Accessor<T>, Setter<T>] {
  return getOrCreate(key, () => {
    const [value, setValue] = createSignal<T>(readString(key, fallback) as T)

    const setAndPersist: Setter<T> = ((next: T | ((prev: T) => T)) => {
      const resolved = setValue((prev) => (typeof next === "function" ? (next as (prev: T) => T)(prev) : next))
      writeString(key, resolved)
      return resolved
    }) as Setter<T>

    const onStorage = (event: StorageEvent) => {
      if (event.key !== key) return
      setValue(() => readString(key, fallback) as T)
    }
    if (typeof window !== "undefined") {
      window.addEventListener("storage", onStorage)
      onCleanup(() => window.removeEventListener("storage", onStorage))
    }

    return [value, setAndPersist]
  })
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

/**
 * Session/default talk mode ("ptt" | "vad"). The composer bar's segmented
 * toggle and the gear popover's "default mode" select both read/write this
 * SAME signal (see the singleton-cache comment above) — per Steve's ask,
 * changing the live toggle also updates the default, which is the simplest
 * consistent behavior.
 */
export function createVoiceModeSetting() {
  return createPersistedVoiceString<VoiceMode>(VOICE_MODE_KEY, "ptt")
}

export function createVadStartMultSetting() {
  return createPersistedVoiceNumber(VAD_START_MULT_KEY, DEFAULT_VAD_GATE_CONFIG.startMult)
}

export function createVadStopMultSetting() {
  return createPersistedVoiceNumber(VAD_STOP_MULT_KEY, DEFAULT_VAD_GATE_CONFIG.stopMult)
}

export function createVadStartFloorMinSetting() {
  return createPersistedVoiceNumber(VAD_START_FLOOR_MIN_KEY, DEFAULT_VAD_GATE_CONFIG.startFloorMin)
}

export function createVadStopFloorMinSetting() {
  return createPersistedVoiceNumber(VAD_STOP_FLOOR_MIN_KEY, DEFAULT_VAD_GATE_CONFIG.stopFloorMin)
}

export function createVadStartMsSetting() {
  return createPersistedVoiceNumber(VAD_START_MS_KEY, DEFAULT_VAD_GATE_CONFIG.startMs)
}

export function createVadStopMsSetting() {
  return createPersistedVoiceNumber(VAD_STOP_MS_KEY, DEFAULT_VAD_GATE_CONFIG.stopMs)
}

export function createVadMinSpeechMsSetting() {
  return createPersistedVoiceNumber(VAD_MIN_SPEECH_MS_KEY, DEFAULT_VAD_GATE_CONFIG.minSpeechMs)
}

export function createVadPrerollMsSetting() {
  return createPersistedVoiceNumber(VAD_PREROLL_MS_KEY, DEFAULT_VAD_GATE_CONFIG.prerollMs)
}

/**
 * Composes the individual persisted VAD fields into a single live
 * `VadGateConfig` getter for `useVoiceLoop`'s `getConfig` prop. Reuses the same
 * singleton signals the gear popover's advanced sliders bind to, so a slider
 * edit takes effect on the very next `push()` call.
 */
export function createVadGateConfigSetting(): Accessor<VadGateConfig> {
  const [startMult] = createVadStartMultSetting()
  const [stopMult] = createVadStopMultSetting()
  const [startFloorMin] = createVadStartFloorMinSetting()
  const [stopFloorMin] = createVadStopFloorMinSetting()
  const [startMs] = createVadStartMsSetting()
  const [stopMs] = createVadStopMsSetting()
  const [minSpeechMs] = createVadMinSpeechMsSetting()
  const [prerollMs] = createVadPrerollMsSetting()

  return () => ({
    startMult: startMult(),
    stopMult: stopMult(),
    startFloorMin: startFloorMin(),
    stopFloorMin: stopFloorMin(),
    startMs: startMs(),
    stopMs: stopMs(),
    minSpeechMs: minSpeechMs(),
    prerollMs: prerollMs(),
    floorAlpha: DEFAULT_VAD_GATE_CONFIG.floorAlpha,
  })
}
