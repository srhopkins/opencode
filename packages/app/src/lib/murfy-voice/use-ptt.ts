// Push-toggle-to-talk: press once to start recording (no VAD/endpointing — this is
// the walking/wind/noisy-room mode where explicit gating beats acoustic detection),
// press again to stop, transcribe, and auto-send. Distinct from dictation
// (use-voice-controls.ts's toggleMic), which inserts into the draft without sending.
// Reuses the same MicCapture/STT plumbing as dictation.
import { createSignal, onCleanup, onMount } from "solid-js"
import { createMicCapture, type MicCapture } from "./mic-capture"
import { transcribeAudio } from "./stt-client"
import { createPttKeyBindingSetting } from "./ptt-key-setting"
import { describeKeyBinding, isSafeWhileEditing, keyBindingFromEvent, matchesKeyBinding } from "./keybinding"

export type PttPhase = "idle" | "recording" | "transcribing"

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.closest("input, textarea, select, [contenteditable='true']") !== null
}

export function usePtt(props: {
  /** Auto-send the transcript as a message, reusing the composer's normal submit path. */
  onSend: (text: string) => void
  /** Stop+clear any in-flight TTS playback (barge-in) right as recording starts. */
  onBargeIn: () => void
  /** Arms the auto-read gate so the reply to this PTT message is always spoken. */
  armForceRead: () => void
  /**
   * When set, hotkey presses route to `onModeHotkey` instead of the PTT
   * toggle while `mode()` returns "vad" — lets the composer-bar integration
   * send the SAME physical key to `useVoiceLoop`'s start/stop/bargeIn when
   * VAD is the active session mode. Leaving both unset preserves plain PTT
   * hotkey behavior (press-toggle-to-talk).
   */
  mode?: () => "ptt" | "vad"
  onModeHotkey?: () => void
}) {
  const [phase, setPhase] = createSignal<PttPhase>("idle")
  const [error, setError] = createSignal<string | null>(null)
  const [keyBinding, setKeyBinding] = createPttKeyBindingSetting()
  const [capturing, setCapturing] = createSignal(false)
  // RMS 0..1 while `phase() === "recording"`; consumed by the composer bar's
  // LevelMeter ring around the unified talk button in PTT mode.
  const [level, setLevel] = createSignal(0)
  let capture: MicCapture | null = null

  const togglePtt = async () => {
    if (phase() === "transcribing") return

    if (phase() === "idle") {
      props.onBargeIn()
      setError(null)
      try {
        const next = createMicCapture()
        await next.start({ onLevel: setLevel })
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
    setLevel(0)
    try {
      const audio = active ? await active.stop() : undefined
      const text = audio ? await transcribeAudio(audio) : ""
      const trimmed = text.trim()
      if (trimmed) {
        props.armForceRead()
        props.onSend(trimmed)
      }
      // Empty/whitespace transcript: discard silently, return to idle.
    } catch (e) {
      setError(e instanceof Error ? e.message : "transcription failed")
    } finally {
      setPhase("idle")
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (capturing()) {
      event.preventDefault()
      event.stopPropagation()
      if (event.key === "Escape") {
        setCapturing(false)
        return
      }
      const next = keyBindingFromEvent(event)
      if (!next) return // bare modifier press; keep waiting for the completing key
      setKeyBinding(next)
      setCapturing(false)
      return
    }

    if (event.repeat) return
    const binding = keyBinding()
    if (!matchesKeyBinding(event, binding)) return
    if (isEditableTarget(event.target) && !isSafeWhileEditing(binding)) return

    event.preventDefault()
    if (props.mode?.() === "vad" && props.onModeHotkey) {
      props.onModeHotkey()
      return
    }
    void togglePtt()
  }

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown, { capture: true })
  })
  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown, { capture: true })
    capture?.cancel()
  })

  return {
    phase,
    error,
    togglePtt: () => void togglePtt(),
    keyBinding,
    describeKeyBinding: () => describeKeyBinding(keyBinding()),
    capturing,
    setCapturing,
    level,
  }
}
