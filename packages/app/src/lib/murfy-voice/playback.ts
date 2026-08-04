// Queued playback for auto-read: text is sentence-split (text-split.ts) and
// each sentence is fetched from the TTS server, with up to LOOKAHEAD requests
// in flight so sentence N+1 is fetching while sentence N plays. Playback uses
// plain HTMLAudioElement + blob URLs, which is simple and works everywhere;
// a true streaming AudioWorklet playback pipeline is scoped to a later bead
// (murfy-44n) once a format-aware streaming proxy exists.
import { textToSpeechChunks } from "./text-split"
import { synthesizeSpeech } from "./tts-client"

const LOOKAHEAD = 2

type QueuedItem = {
  text: string
  promise: Promise<Blob>
  controller: AbortController
}

export class SpeechQueue {
  private pending: string[] = []
  private active: QueuedItem[] = []
  private currentAudio: HTMLAudioElement | null = null
  private pumping = false
  private stopped = true
  private onSpeakingChange?: (speaking: boolean) => void

  constructor(options?: { onSpeakingChange?: (speaking: boolean) => void }) {
    this.onSpeakingChange = options?.onSpeakingChange
  }

  /** Splits `text` into sentences and appends them to the playback queue. */
  enqueueText(text: string) {
    const chunks = textToSpeechChunks(text)
    if (chunks.length === 0) return
    this.stopped = false
    this.pending.push(...chunks)
    this.fill()
    void this.pump()
  }

  isSpeaking() {
    return this.pumping
  }

  /** Stops playback immediately, aborts in-flight fetches, and clears the queue. */
  stop() {
    this.stopped = true
    this.pending = []
    for (const item of this.active) item.controller.abort()
    this.active = []
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ""
      this.currentAudio = null
    }
    this.setSpeaking(false)
  }

  private setSpeaking(speaking: boolean) {
    this.onSpeakingChange?.(speaking)
  }

  private fill() {
    while (!this.stopped && this.active.length < LOOKAHEAD && this.pending.length > 0) {
      const text = this.pending.shift()!
      const controller = new AbortController()
      const promise = synthesizeSpeech(text, controller.signal).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("[murfy-voice] TTS fetch failed", error)
        }
        return new Blob()
      })
      this.active.push({ text, promise, controller })
    }
  }

  private async pump() {
    if (this.pumping) return
    this.pumping = true
    this.setSpeaking(true)
    try {
      while (!this.stopped && this.active.length > 0) {
        const item = this.active.shift()!
        this.fill()
        const blob = await item.promise
        if (this.stopped) break
        if (blob.size > 0) await this.playBlob(blob)
      }
    } finally {
      this.pumping = false
      this.setSpeaking(false)
    }
  }

  private playBlob(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      this.currentAudio = audio
      const cleanup = () => {
        URL.revokeObjectURL(url)
        if (this.currentAudio === audio) this.currentAudio = null
        resolve()
      }
      audio.onended = cleanup
      audio.onerror = cleanup
      audio.play().catch(cleanup)
    })
  }
}
