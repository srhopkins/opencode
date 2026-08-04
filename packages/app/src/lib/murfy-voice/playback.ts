// Queued playback for auto-read: text is sentence-split (text-split.ts) and
// each sentence is fetched from the TTS server, with up to LOOKAHEAD requests
// in flight so sentence N+1 is fetching while sentence N plays. Playback uses
// plain HTMLAudioElement + blob URLs, which is simple and works everywhere;
// a true streaming AudioWorklet playback pipeline is scoped to a later bead
// (murfy-44n) once a format-aware streaming proxy exists.
//
// Between chunks, pump() waits sentenceGapMs() (or the chunk's own gapAfterMs
// at comma seams). Gaps are cancelled immediately by stop().
import { textToSpeechChunks, type SpeechChunk } from "./text-split"
import { synthesizeSpeech } from "./tts-client"

const LOOKAHEAD = 2

type QueuedItem = {
  text: string
  gapAfterMs?: number
  promise: Promise<Blob>
  controller: AbortController
}

export class SpeechQueue {
  private pending: SpeechChunk[] = []
  private active: QueuedItem[] = []
  private currentAudio: HTMLAudioElement | null = null
  private pumping = false
  private stopped = true
  /** Bumped by stop() so an in-flight pump() finally cannot clobber a newer run. */
  private pumpGeneration = 0
  private onSpeakingChange?: (speaking: boolean) => void
  private sentenceGapMs: () => number
  private ttsSpeed: () => number
  private commaSplitMinWords: () => number
  private commaGapMs: () => number
  private gapCancel: (() => void) | null = null

  constructor(options?: {
    onSpeakingChange?: (speaking: boolean) => void
    sentenceGapMs?: () => number
    ttsSpeed?: () => number
    commaSplitMinWords?: () => number
    /** Fresh comma-seam silence; passed into textToSpeechChunks. Default 250. */
    commaGapMs?: () => number
  }) {
    this.onSpeakingChange = options?.onSpeakingChange
    this.sentenceGapMs = options?.sentenceGapMs ?? (() => 0)
    this.ttsSpeed = options?.ttsSpeed ?? (() => 1)
    this.commaSplitMinWords = options?.commaSplitMinWords ?? (() => 0)
    this.commaGapMs = options?.commaGapMs ?? (() => 250)
  }

  /** Splits `text` into speech chunks and appends them to the playback queue. */
  enqueueText(text: string) {
    const chunks = textToSpeechChunks(text, {
      commaSplitMinWords: this.commaSplitMinWords(),
      commaGapMs: this.commaGapMs(),
    })
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
    this.pumping = false
    this.pumpGeneration += 1
    this.pending = []
    for (const item of this.active) item.controller.abort()
    this.active = []
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ""
      this.currentAudio = null
    }
    // Cancel any in-flight sentence/comma gap so pump() unwinds immediately.
    this.cancelGap()
    this.setSpeaking(false)
  }

  private cancelGap() {
    const cancel = this.gapCancel
    this.gapCancel = null
    cancel?.()
  }

  private waitGap(ms: number): Promise<void> {
    if (ms <= 0 || this.stopped) return Promise.resolve()
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.gapCancel = null
        resolve()
      }, ms)
      this.gapCancel = () => {
        clearTimeout(timer)
        this.gapCancel = null
        resolve()
      }
    })
  }

  private setSpeaking(speaking: boolean) {
    this.onSpeakingChange?.(speaking)
  }

  private fill() {
    while (!this.stopped && this.active.length < LOOKAHEAD && this.pending.length > 0) {
      const chunk = this.pending.shift()!
      const controller = new AbortController()
      const speed = this.ttsSpeed()
      const promise = synthesizeSpeech(chunk.text, controller.signal, { speed }).catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("[murfy-voice] TTS fetch failed", error)
        }
        return new Blob()
      })
      this.active.push({ text: chunk.text, gapAfterMs: chunk.gapAfterMs, promise, controller })
    }
  }

  private async pump() {
    if (this.pumping) return
    this.pumping = true
    const generation = this.pumpGeneration
    this.setSpeaking(true)
    try {
      while (!this.stopped && this.active.length > 0) {
        const item = this.active.shift()!
        this.fill()
        const blob = await item.promise
        if (this.stopped) break
        if (blob.size > 0) await this.playBlob(blob)
        if (this.stopped) break
        const hasMore = this.active.length > 0 || this.pending.length > 0
        if (!hasMore) break
        // Comma seams carry gapAfterMs; otherwise use the live sentence gap.
        const gapMs = item.gapAfterMs ?? this.sentenceGapMs()
        await this.waitGap(gapMs)
      }
    } finally {
      if (this.pumpGeneration === generation) {
        this.pumping = false
        this.setSpeaking(false)
      }
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
