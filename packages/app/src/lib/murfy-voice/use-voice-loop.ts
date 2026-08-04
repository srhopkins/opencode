// Solid hook orchestrating the full open-mic conversation loop:
//   idle -> armed -> capturing -> transcribing -> thinking -> speaking -> armed
// driven by VadGate boundaries and an externally-owned TTS speaking signal.
//
// Deliberately does NOT import mic-capture.ts / tts-client.ts / playback.ts /
// text-split.ts / settings.ts: those are being reshaped concurrently by sibling
// agents in the same voice-features wave. Integration (post-merge) wires the real
// `createCapture` (mic-capture.ts's createMicCapture, once it grows the `onLevel`
// start option per the frozen contract), `isTtsSpeaking`/`onTtsStop` (from the
// SpeechQueue used by auto-read/PTT plumbing), and `armForceRead` (auto-read.ts).
// Only stt-client.ts (transcribeAudio) is stable/unowned-by-siblings, so it's safe
// to default here.
//
// Capture-slicing choice (v1 — see bead murfy-azy notes for the full trade-off):
// ONE MicCapture instance spans the whole armed+capturing period. It is only
// stop()'d at a confirmed (non-discarded) speech-end, so the resulting Blob
// includes preroll + speech + trailing silence — server STT tolerates leading/
// trailing silence fine. A *discarded* (too-short) speech-end does NOT stop the
// capture: the mic keeps running and the same instance keeps listening for the
// next real utterance (this also means the "one Blob per utterance" property
// only holds for utterances that survive minSpeechMs). A fresh capture is only
// started when re-arming after a completed send-cycle (empty transcript, or TTS
// finished) or on bargeIn (no preroll available there by definition — the user
// is already mid-utterance). Trade-off: a very long silent armed period before
// any speech yields one long, mostly-silent Blob sent to STT; acceptable v1 per
// bead instructions. Alternative for a future pass: restart capture on every
// re-arm boundary to bound clip length, at the cost of losing preroll on the
// very first utterance after each arm.
import { createSignal, onCleanup, type Accessor } from "solid-js"
import { transcribeAudio } from "./stt-client"
import { DEFAULT_VAD_GATE_CONFIG, VadGate, type VadGateConfig } from "./vad-gate"

export type VoiceLoopState = "idle" | "armed" | "capturing" | "transcribing" | "thinking" | "speaking"

export interface MicCaptureStartOptions {
  onLevel?: (rms: number) => void
}

/** Shape-compatible subset of mic-capture.ts's `MicCapture` (frozen contract). */
export interface MicCaptureLike {
  start(opts?: MicCaptureStartOptions): Promise<void>
  stop(): Promise<Blob>
  isRecording(): boolean
  cancel(): void
}

// The frozen contract only gives us a plain `isTtsSpeaking(): boolean` getter, not
// an event/signal, and TTS playback lives outside this file's scope — so the
// thinking->speaking and speaking->armed edges are detected by polling.
const TTS_POLL_MS = 40

export function useVoiceLoop(props: {
  onSend: (text: string) => void
  armForceRead: () => void
  createCapture?: () => MicCaptureLike
  transcribe?: (audio: Blob) => Promise<string>
  isTtsSpeaking: () => boolean
  onTtsStop: () => void
  getConfig?: () => VadGateConfig
}): {
  state: Accessor<VoiceLoopState>
  level: Accessor<number>
  start: () => void
  stop: () => void
  bargeIn: () => void
  error: Accessor<string | null>
} {
  const [state, setState] = createSignal<VoiceLoopState>("idle")
  const [level, setLevel] = createSignal(0)
  const [error, setError] = createSignal<string | null>(null)

  let capture: MicCaptureLike | null = null
  let gate: VadGate | null = null
  let pollHandle: ReturnType<typeof setInterval> | undefined

  const currentConfig = () => (props.getConfig ? props.getConfig() : DEFAULT_VAD_GATE_CONFIG)

  const clearPoll = () => {
    if (pollHandle !== undefined) {
      clearInterval(pollHandle)
      pollHandle = undefined
    }
  }

  // Polls isTtsSpeaking() while thinking/speaking to catch the two edges we don't
  // otherwise get told about: TTS actually starting (thinking -> speaking) and TTS
  // finishing (speaking -> re-arm). Self-cancels once state leaves this range.
  const watchForTtsEdges = () => {
    clearPoll()
    pollHandle = setInterval(() => {
      const current = state()
      if (current === "thinking") {
        if (props.isTtsSpeaking()) setState("speaking")
        return
      }
      if (current === "speaking") {
        if (!props.isTtsSpeaking()) {
          clearPoll()
          void arm()
        }
        return
      }
      clearPoll()
    }, TTS_POLL_MS)
  }

  // The single onLevel callback handed to every capture instance across the
  // loop's lifetime. Gates on `state()` alone (not a separate isTtsSpeaking()
  // check) so that a stale/late level sample delivered while thinking/speaking
  // is a guaranteed no-op — this IS the half-duplex suspension.
  const handleLevel = (rms: number) => {
    setLevel(rms)
    const current = state()
    if (current !== "armed" && current !== "capturing") return
    if (!gate) return
    const event = gate.push(rms, Date.now())
    if (!event) return
    if (event.type === "speech-start") {
      setState("capturing")
      return
    }
    if (event.discarded) {
      // Too short to count as an utterance: stay armed, keep the same capture
      // (and its accumulated preroll-so-far) running for the next attempt.
      setState("armed")
      return
    }
    void finishCapture()
  }

  async function arm() {
    setError(null)
    gate = new VadGate(currentConfig())
    const factory = props.createCapture
    if (!factory) {
      setError("no mic capture factory configured")
      setState("idle")
      return
    }
    try {
      const next = factory()
      await next.start({ onLevel: handleLevel })
      capture = next
      setState("armed")
    } catch (e) {
      setError(e instanceof Error ? e.message : "mic unavailable")
      setState("idle")
    }
  }

  async function finishCapture() {
    setState("transcribing")
    const active = capture
    capture = null
    try {
      const blob = active ? await active.stop() : new Blob()
      const transcribe = props.transcribe ?? transcribeAudio
      const text = blob.size > 0 ? await transcribe(blob) : ""
      const trimmed = text.trim()
      if (trimmed) {
        props.armForceRead()
        props.onSend(trimmed)
        setState("thinking")
        watchForTtsEdges()
      } else {
        // Empty/whitespace transcript: discard silently, re-arm with a fresh
        // capture (the previous one already stopped to produce this Blob).
        await arm()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "transcription failed")
      await arm()
    }
  }

  const start = () => {
    if (state() !== "idle") return
    void arm()
  }

  const stop = () => {
    clearPoll()
    capture?.cancel()
    capture = null
    gate = null
    setState("idle")
  }

  const bargeIn = () => {
    if (state() !== "speaking") return
    clearPoll()
    props.onTtsStop()
    gate = new VadGate(currentConfig())
    setState("capturing")
    const factory = props.createCapture
    if (!factory) {
      setError("no mic capture factory configured")
      setState("idle")
      return
    }
    void (async () => {
      try {
        const next = factory()
        await next.start({ onLevel: handleLevel })
        capture = next
      } catch (e) {
        setError(e instanceof Error ? e.message : "mic unavailable")
        setState("idle")
      }
    })()
  }

  onCleanup(() => {
    clearPoll()
    capture?.cancel()
  })

  return { state, level, start, stop, bargeIn, error }
}
