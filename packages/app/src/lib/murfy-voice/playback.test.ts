import { afterEach, beforeEach, describe, expect, mock, test, vi } from "bun:test"
import { SpeechQueue } from "./playback"

const synthesizeBodies: Array<Record<string, unknown>> = []

class FakeAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  src = ""
  play() {
    queueMicrotask(() => this.onended?.())
    return Promise.resolve()
  }
  pause() {}
}

async function flushMicrotasks(times = 20) {
  for (let i = 0; i < times; i++) await Promise.resolve()
}

describe("SpeechQueue gaps", () => {
  const OriginalAudio = globalThis.Audio
  const OriginalFetch = globalThis.fetch

  beforeEach(() => {
    synthesizeBodies.length = 0
    // @ts-expect-error test double for HTMLAudioElement
    globalThis.Audio = FakeAudio
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      synthesizeBodies.push(body)
      return new Response(new Uint8Array([1, 2, 3, 4]), {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      })
    }) as unknown as typeof fetch
    vi.useFakeTimers()
  })

  afterEach(() => {
    globalThis.Audio = OriginalAudio
    globalThis.fetch = OriginalFetch
    vi.useRealTimers()
  })

  test("waits sentenceGapMs between sentence chunks", async () => {
    let gapReads = 0
    const queue = new SpeechQueue({
      sentenceGapMs: () => {
        gapReads += 1
        return 450
      },
      commaSplitMinWords: () => 0,
    })

    queue.enqueueText("First sentence. Second sentence.")
    await flushMicrotasks()

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    expect(gapReads).toBe(1)

    vi.advanceTimersByTime(449)
    await flushMicrotasks()
    expect(queue.isSpeaking()).toBe(true)

    vi.advanceTimersByTime(1)
    await flushMicrotasks()
    expect(synthesizeBodies.map((b) => b.input)).toEqual(["First sentence.", "Second sentence."])
    expect(queue.isSpeaking()).toBe(false)
  })

  test("uses chunk.gapAfterMs at comma seams instead of sentenceGapMs", async () => {
    let sentenceReads = 0
    const queue = new SpeechQueue({
      sentenceGapMs: () => {
        sentenceReads += 1
        return 450
      },
      commaSplitMinWords: () => 4,
      commaGapMs: () => 250,
    })

    queue.enqueueText("We considered the options, and after a long discussion we decided to proceed carefully.")
    await flushMicrotasks()

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    expect(sentenceReads).toBe(0)

    vi.advanceTimersByTime(249)
    await flushMicrotasks()
    expect(queue.isSpeaking()).toBe(true)

    vi.advanceTimersByTime(1)
    await flushMicrotasks()

    expect(sentenceReads).toBe(0)
    expect(synthesizeBodies).toHaveLength(2)
    expect(queue.isSpeaking()).toBe(false)
  })

  test("stop() during a gap resolves immediately with no dangling timer", async () => {
    let speaking = true
    const queue = new SpeechQueue({
      onSpeakingChange: (next) => {
        speaking = next
      },
      sentenceGapMs: () => 5_000,
      commaSplitMinWords: () => 0,
    })

    queue.enqueueText("First sentence. Second sentence.")
    await flushMicrotasks()

    expect(queue.isSpeaking()).toBe(true)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    queue.stop()
    // stop() must cancel the in-flight gap wait synchronously (no need to advance timers).
    expect(queue.isSpeaking()).toBe(false)
    expect(speaking).toBe(false)

    await flushMicrotasks()
    vi.advanceTimersByTime(10_000)
    await flushMicrotasks()

    // Advancing past the original gap must not resurrect playback.
    expect(queue.isSpeaking()).toBe(false)
    expect(speaking).toBe(false)
  })

  test("passes ttsSpeed into synthesizeSpeech body when !== 1", async () => {
    const queue = new SpeechQueue({
      ttsSpeed: () => 1.5,
      sentenceGapMs: () => 0,
    })
    queue.enqueueText("Only one.")
    await flushMicrotasks()
    expect(synthesizeBodies.some((b) => b.speed === 1.5)).toBe(true)
  })
})
