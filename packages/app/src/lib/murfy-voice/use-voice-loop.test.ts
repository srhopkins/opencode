import { afterEach, describe, expect, test } from "bun:test"
import { createRoot } from "solid-js"
import { useVoiceLoop, type MicCaptureLike, type MicCaptureStartOptions } from "./use-voice-loop"

class MockCapture implements MicCaptureLike {
  onLevel?: (rms: number) => void
  recording = false
  canceled = false
  stopCalls = 0
  cancelCalls = 0

  async start(opts?: MicCaptureStartOptions) {
    this.onLevel = opts?.onLevel
    this.recording = true
  }

  async stop(): Promise<Blob> {
    this.stopCalls++
    this.recording = false
    return new Blob(["fake-audio"])
  }

  isRecording() {
    return this.recording
  }

  cancel() {
    this.cancelCalls++
    this.canceled = true
    this.recording = false
  }
}

function setup(overrides: { transcribe?: (audio: Blob) => Promise<string> } = {}) {
  const captures: MockCapture[] = []
  const sent: string[] = []
  let armForceReadCalls = 0
  let ttsStopCalls = 0
  let ttsSpeaking = false

  const dispose$: { current: () => void } = { current: () => {} }
  const loop = createRoot((dispose) => {
    dispose$.current = dispose
    return useVoiceLoop({
      onSend: (text) => sent.push(text),
      armForceRead: () => {
        armForceReadCalls++
      },
      createCapture: () => {
        const capture = new MockCapture()
        captures.push(capture)
        return capture
      },
      transcribe: overrides.transcribe ?? (async () => "hello"),
      isTtsSpeaking: () => ttsSpeaking,
      onTtsStop: () => {
        ttsStopCalls++
      },
    })
  })

  return {
    loop,
    captures,
    sent,
    getArmForceReadCalls: () => armForceReadCalls,
    getTtsStopCalls: () => ttsStopCalls,
    setTtsSpeaking: (value: boolean) => {
      ttsSpeaking = value
    },
    dispose: () => dispose$.current(),
  }
}

const microtask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
const realDelay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

let fakeNow = 0
let dateNowStubbed = false
const originalDateNow = Date.now

function stubDateNow() {
  fakeNow = 0
  dateNowStubbed = true
  Date.now = () => fakeNow
}

function restoreDateNow() {
  if (dateNowStubbed) {
    Date.now = originalDateNow
    dateNowStubbed = false
  }
}

afterEach(() => {
  restoreDateNow()
})

/** Drives a capture's onLevel with a synthetic, VAD-config-compatible sequence
 * that reaches a confirmed (non-discarded) speech-end. Assumes DEFAULT_VAD_GATE_CONFIG. */
function driveToSpeechEnd(capture: MockCapture) {
  const push = (level: number, dt: number) => {
    fakeNow += dt
    capture.onLevel?.(level)
  }
  push(0.005, 0) // baseline noise, establishes floor
  push(0.005, 100)
  push(0.05, 20) // first loud sample (aboveSinceMs)
  push(0.05, 140) // elapsed 140ms >= startMs(120) -> speech-start
  push(0.05, 100) // stay loud (total speech so far well over minSpeechMs)
  push(0.05, 100)
  push(0.005, 50) // first quiet sample (belowSinceMs)
  push(0.005, 700) // elapsed 700ms >= stopMs(700) -> speech-end, not discarded
}

describe("useVoiceLoop (DoD 7-11)", () => {
  test("DoD 7: full happy path reaches thinking with onSend + armForceRead called", async () => {
    const ctx = setup()
    stubDateNow()
    try {
      expect(ctx.loop.state()).toBe("idle")
      ctx.loop.start()
      await microtask()
      expect(ctx.loop.state()).toBe("armed")

      const capture = ctx.captures[0]
      expect(capture).toBeDefined()
      driveToSpeechEnd(capture)
      expect(ctx.loop.state()).toBe("transcribing")

      await microtask()
      await microtask()

      expect(ctx.sent).toEqual(["hello"])
      expect(ctx.getArmForceReadCalls()).toBe(1)
      expect(ctx.loop.state()).toBe("thinking")
    } finally {
      ctx.dispose()
    }
  })

  test("DoD 8: empty/whitespace transcript does not send and re-arms", async () => {
    const ctx = setup({ transcribe: async () => "   " })
    stubDateNow()
    try {
      ctx.loop.start()
      await microtask()
      driveToSpeechEnd(ctx.captures[0])
      await microtask()
      await microtask()

      expect(ctx.sent).toEqual([])
      expect(ctx.getArmForceReadCalls()).toBe(0)
      expect(ctx.loop.state()).toBe("armed")
      // Re-armed with a fresh capture instance (the first one already stopped).
      expect(ctx.captures.length).toBe(2)
    } finally {
      ctx.dispose()
    }
  })

  test("DoD 9: while speaking, injected loud levels cause no transitions", async () => {
    const ctx = setup()
    stubDateNow()
    ctx.loop.start()
    await microtask()
    driveToSpeechEnd(ctx.captures[0])
    await microtask()
    await microtask()
    expect(ctx.loop.state()).toBe("thinking")
    restoreDateNow()

    try {
      ctx.setTtsSpeaking(true)
      // Poll interval is 40ms; give it a few cycles of real time to observe the flip.
      await realDelay(150)
      expect(ctx.loop.state()).toBe("speaking")

      const staleCapture = ctx.captures[0]
      const capturesBefore = ctx.captures.length
      const sentBefore = [...ctx.sent]
      staleCapture.onLevel?.(0.9)
      staleCapture.onLevel?.(0.9)
      staleCapture.onLevel?.(0.9)

      expect(ctx.loop.state()).toBe("speaking")
      expect(ctx.captures.length).toBe(capturesBefore)
      expect(ctx.sent).toEqual(sentBefore)
      expect(ctx.getTtsStopCalls()).toBe(0)
    } finally {
      ctx.dispose()
    }
  })

  test("DoD 10: bargeIn from speaking stops TTS and moves straight to capturing", async () => {
    const ctx = setup()
    stubDateNow()
    ctx.loop.start()
    await microtask()
    driveToSpeechEnd(ctx.captures[0])
    await microtask()
    await microtask()
    restoreDateNow()

    try {
      ctx.setTtsSpeaking(true)
      await realDelay(150)
      expect(ctx.loop.state()).toBe("speaking")

      ctx.loop.bargeIn()
      // onTtsStop + the capturing transition happen synchronously, before the new
      // capture's start() promise even resolves.
      expect(ctx.getTtsStopCalls()).toBe(1)
      expect(ctx.loop.state()).toBe("capturing")

      await microtask()
      expect(ctx.captures.length).toBe(2)
      expect(ctx.captures[1]?.recording).toBe(true)
    } finally {
      ctx.dispose()
    }
  })

  test("DoD 11: stop() during capturing cancels the capture and returns to idle", async () => {
    const ctx = setup()
    stubDateNow()
    try {
      ctx.loop.start()
      await microtask()
      const push = (level: number, dt: number) => {
        fakeNow += dt
        ctx.captures[0]?.onLevel?.(level)
      }
      push(0.005, 0)
      push(0.05, 20)
      push(0.05, 140) // speech-start -> capturing
      expect(ctx.loop.state()).toBe("capturing")

      ctx.loop.stop()

      expect(ctx.captures[0]?.cancelCalls).toBe(1)
      expect(ctx.loop.state()).toBe("idle")
    } finally {
      ctx.dispose()
    }
  })
})
