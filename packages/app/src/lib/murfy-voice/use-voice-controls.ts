// Shared state/logic behind the composer voice controls, independent of which
// prompt-input UI (legacy v1 or v2) renders them. Two presentational wrappers
// consume this: voice-controls.tsx (v1) and voice-controls-v2.tsx (v2, the
// default layout as of this fork).
//
// Phase C (this file): unifies PTT (usePtt) and the full VAD conversation
// loop (useVoiceLoop, murfy-azy) behind ONE "talk" surface so both composer
// layouts can render a single talk button + level ring that behaves
// correctly regardless of which mode is currently active. See murfy-azy's
// bead notes for the useVoiceLoop wiring contract this satisfies.
import { createMemo, createSignal, onMount, type Accessor } from "solid-js"
import type { DirectorySync } from "@/context/sync"
import { createMicCapture, type MicCapture } from "./mic-capture"
import { transcribeAudio } from "./stt-client"
import { createAutoReadSetting, createVadGateConfigSetting, createVoiceModeSetting, type VoiceMode } from "./settings"
import { createAutoReadReplies } from "./auto-read"
import { usePtt } from "./use-ptt"
import { useVoiceLoop, type VoiceLoopState } from "./use-voice-loop"

export type MicPhase = "idle" | "recording" | "transcribing"

export function useVoiceControls(props: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
  onTranscribed: (text: string) => void
  /** Auto-send the PTT/VAD transcript as a message (reuses the composer's submit path). */
  onAutoSend: (text: string) => void
}) {
  const dictation = createDictation(props)

  const [autoRead, setAutoRead] = createAutoReadSetting()
  const autoReadReplies = createAutoReadReplies({ sessionID: props.sessionID, sync: props.sync, enabled: autoRead })

  // Session-local AND persisted default (per Steve's ask, these are the same
  // signal — see settings.ts's createVoiceModeSetting comment): the bar
  // toggle changes the live mode immediately and that IS the new default.
  const [mode, setMode] = createVoiceModeSetting()

  const vadConfig = createVadGateConfigSetting()
  const voiceLoop = useVoiceLoop({
    onSend: props.onAutoSend,
    armForceRead: () => autoReadReplies.armForceRead(),
    createCapture: createMicCapture,
    isTtsSpeaking: () => autoReadReplies.isSpeaking(),
    onTtsStop: () => autoReadReplies.stop(),
    getConfig: vadConfig,
  })

  // Only handles the VAD side; guarded by `mode() === "vad"` in usePtt before
  // ever being invoked, so it never needs to know about PTT itself.
  const onVadHotkey = () => {
    const state = voiceLoop.state()
    if (state === "speaking") {
      voiceLoop.bargeIn()
      return
    }
    if (state === "idle") {
      voiceLoop.start()
      return
    }
    voiceLoop.stop()
  }

  const ptt = usePtt({
    onSend: props.onAutoSend,
    onBargeIn: () => autoReadReplies.stop(),
    armForceRead: () => autoReadReplies.armForceRead(),
    mode,
    onModeHotkey: onVadHotkey,
  })

  const talkPress = () => {
    if (mode() === "vad") {
      onVadHotkey()
      return
    }
    ptt.togglePtt()
  }

  // Eval-test hook only (see DoD 2f): lets Playwright/devtools drive the level
  // ring without a real mic. `null` (default) means "no override, use the
  // real PTT/VAD level as normal". Registered on `window` only in dev builds.
  const [debugLevelOverride, setDebugLevelOverride] = createSignal<number | null>(null)
  if (import.meta.env.DEV) {
    onMount(() => {
      ;(window as unknown as { __murfyVoiceDebug?: unknown }).__murfyVoiceDebug = {
        setLevel: (value: number) => setDebugLevelOverride(Math.min(1, Math.max(0, value))),
        clearLevel: () => setDebugLevelOverride(null),
      }
    })
  }

  // Mic is "actually open" for the level ring during armed+capturing in VAD
  // (one MicCapture instance spans both, per use-voice-loop.ts's header
  // comment) and only during "recording" in PTT.
  const talkMicOpen = createMemo(() => {
    if (debugLevelOverride() !== null) return true
    if (mode() === "vad") {
      const state = voiceLoop.state()
      return state === "armed" || state === "capturing"
    }
    return ptt.phase() === "recording"
  })

  const talkLevel = createMemo(() => debugLevelOverride() ?? (mode() === "vad" ? voiceLoop.level() : ptt.level()))
  const talkDanger = createMemo(() => (mode() === "vad" ? voiceLoop.state() === "capturing" : ptt.phase() === "recording"))
  const talkSpeaking = createMemo(() => mode() === "vad" && voiceLoop.state() === "speaking")
  const talkBusy = createMemo(() =>
    mode() === "vad"
      ? voiceLoop.state() === "transcribing" || voiceLoop.state() === "thinking"
      : ptt.phase() === "transcribing",
  )
  const talkLabel = createMemo((): string => {
    if (mode() === "ptt") {
      return ptt.phase() === "recording"
        ? "Push-to-talk: press again to send"
        : ptt.phase() === "transcribing"
          ? "Sending…"
          : `Push-to-talk (${ptt.describeKeyBinding()})`
    }
    const state: VoiceLoopState = voiceLoop.state()
    switch (state) {
      case "idle":
        return `Start voice mode (${ptt.describeKeyBinding()})`
      case "armed":
        return "Listening…"
      case "capturing":
        return "Capturing speech…"
      case "transcribing":
        return "Transcribing…"
      case "thinking":
        return "Thinking…"
      case "speaking":
        return "Speaking — tap to interrupt"
    }
  })
  const talkError = createMemo(() => ptt.error() ?? voiceLoop.error())

  return {
    ...dictation,
    autoRead,
    toggleAutoRead: () => setAutoRead((value) => !value),
    ptt,
    mode,
    setMode: (next: VoiceMode) => setMode(next),
    voiceLoop,
    talk: {
      mode,
      icon: createMemo<"headset" | "waveform">(() => (mode() === "vad" ? "waveform" : "headset")),
      label: talkLabel,
      micOpen: talkMicOpen,
      level: talkLevel,
      danger: talkDanger,
      speaking: talkSpeaking,
      busy: talkBusy,
      error: talkError,
      press: talkPress,
    },
  }
}

function createDictation(props: {
  onTranscribed: (text: string) => void
}) {
  const [phase, setPhase] = createSignal<MicPhase>("idle")
  const [error, setError] = createSignal<string | null>(null)
  let capture: MicCapture | null = null

  const toggleMic = async () => {
    if (phase() === "transcribing") return

    if (phase() === "idle") {
      setError(null)
      try {
        const next = createMicCapture()
        await next.start()
        capture = next
        setPhase("recording")
      } catch (e) {
        setError(e instanceof Error ? e.message : "mic unavailable")
        setPhase("idle")
      }
      return
    }

    setPhase("transcribing")
    const active = capture
    capture = null
    try {
      const audio = active ? await active.stop() : undefined
      const text = audio ? await transcribeAudio(audio) : ""
      if (text) props.onTranscribed(text)
    } catch (e) {
      setError(e instanceof Error ? e.message : "transcription failed")
    } finally {
      setPhase("idle")
    }
  }

  return {
    phase,
    error,
    toggleMic: () => void toggleMic(),
  }
}
