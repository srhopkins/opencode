// Shared state/logic behind the composer voice controls, independent of which
// prompt-input UI (legacy v1 or v2) renders them. Two presentational wrappers
// consume this: voice-controls.tsx (v1) and voice-controls-v2.tsx (v2, the
// default layout as of this fork).
import { createSignal, type Accessor } from "solid-js"
import type { DirectorySync } from "@/context/sync"
import { createMicCapture, type MicCapture } from "./mic-capture"
import { transcribeAudio } from "./stt-client"
import { createAutoReadSetting } from "./settings"
import { createAutoReadReplies } from "./auto-read"

export type MicPhase = "idle" | "recording" | "transcribing"

export function useVoiceControls(props: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
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

  const [autoRead, setAutoRead] = createAutoReadSetting()
  createAutoReadReplies({ sessionID: props.sessionID, sync: props.sync, enabled: autoRead })

  return {
    phase,
    error,
    toggleMic: () => void toggleMic(),
    autoRead,
    toggleAutoRead: () => setAutoRead((value) => !value),
  }
}
