import { describe, expect, test } from "bun:test"
import { DEFAULT_VAD_GATE_CONFIG, VadGate, type VadGateConfig } from "./vad-gate"

function feed(gate: VadGate, level: number, times: number, intervalMs: number, startAtMs = 0) {
  let t = startAtMs
  for (let i = 0; i < times; i++) {
    gate.push(level, t)
    t += intervalMs
  }
  return t
}

describe("VadGate: noise-floor adaptation (DoD 1)", () => {
  test("10s of quiet noise converges the floor near the noise level, with min-floor thresholds", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    // 10s @ 100ms cadence = 100 samples, well within EWMA convergence at alpha=0.05.
    const lastAtMs = feed(gate, 0.005, 100, 100)

    const afterNoise = gate.thresholds()
    expect(afterNoise.floor).toBeCloseTo(0.005, 3)

    // Now a louder-but-not-yet-confirmed sample: thresholds() must reflect both the
    // adapted floor AND the configured minimum floors (max(floor*mult, floorMin)).
    const event = gate.push(0.02, lastAtMs + 100)
    expect(event).toBeNull() // single sample, startMs=120 not yet sustained
    const afterLoudSample = gate.thresholds()
    expect(afterLoudSample.start).toBeGreaterThanOrEqual(DEFAULT_VAD_GATE_CONFIG.startFloorMin)
    expect(afterLoudSample.stop).toBeGreaterThanOrEqual(DEFAULT_VAD_GATE_CONFIG.stopFloorMin)
    expect(afterLoudSample.start).toBeCloseTo(Math.max(afterLoudSample.floor * 3, 0.015), 6)
  })
})

describe("VadGate: startMs debounce (DoD 2)", () => {
  test("a 100ms spike above threshold does not fire speech-start", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    feed(gate, 0.001, 20, 10) // establish a quiet floor first
    let t = 200
    let fired = false
    // Loud run for 100ms total (spanning start->end), then drop back to quiet.
    for (const dt of [0, 50, 100]) {
      const event = gate.push(0.05, t + dt)
      if (event) fired = true
    }
    t += 120
    gate.push(0.001, t) // drop back to quiet before startMs elapses
    expect(fired).toBe(false)
  })

  test("a 130ms sustained run above threshold does fire speech-start", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    feed(gate, 0.001, 20, 10)
    const t0 = 500
    let event = gate.push(0.05, t0)
    expect(event).toBeNull()
    event = gate.push(0.05, t0 + 130)
    expect(event).toEqual({ type: "speech-start" })
  })
})

describe("VadGate: stopMs debounce (DoD 3)", () => {
  test("speech-end fires only after stopMs continuously below the stop threshold; brief dips don't end speech", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    feed(gate, 0.001, 20, 10) // quiet floor
    let t = 500
    expect(gate.push(0.05, t)).toBeNull()
    t += 130
    expect(gate.push(0.05, t)).toEqual({ type: "speech-start" })

    // Extend speech well past minSpeechMs before any silence.
    t += 300
    expect(gate.push(0.05, t)).toBeNull()

    // Brief dip below stop threshold (300ms), then loud again: must NOT end speech.
    t += 300
    expect(gate.push(0.001, t)).toBeNull()
    t += 100
    expect(gate.push(0.05, t)).toBeNull() // back to loud, dip reset

    // Now a real sustained silence >= stopMs (700ms).
    t += 50
    expect(gate.push(0.001, t)).toBeNull()
    t += 699
    expect(gate.push(0.001, t)).toBeNull() // 699ms elapsed, not yet
    t += 1
    const event = gate.push(0.001, t) // 700ms elapsed, fires
    expect(event?.type).toBe("speech-end")
  })
})

describe("VadGate: minSpeechMs discard (DoD 4)", () => {
  test("speech shorter than minSpeechMs (excluding trailing silence) is discarded", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    feed(gate, 0.001, 20, 10)
    // speechStartAtMs is backdated to when the loud run began (t=1000), not to the
    // t=1130 confirmation instant — so going quiet 50ms after confirmation still
    // only accumulates 180ms of measured speech, well under minSpeechMs(250).
    let t = 1000
    expect(gate.push(0.05, t)).toBeNull()
    t += 130
    expect(gate.push(0.05, t)).toEqual({ type: "speech-start" })

    t += 50
    expect(gate.push(0.001, t)).toBeNull() // belowSinceMs set here
    t += 700
    const event = gate.push(0.001, t)
    expect(event).toEqual({ type: "speech-end", speechMs: 180, discarded: true })
  })

  test("speech at/above minSpeechMs (excluding trailing silence) is not discarded", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    feed(gate, 0.001, 20, 10)
    // Same backdating as above: speechStartAtMs=1000, confirmation at t=1130. Going
    // quiet at t=1300 accumulates 300ms of measured speech, at/above minSpeechMs(250).
    let t = 1000
    expect(gate.push(0.05, t)).toBeNull()
    t += 130
    expect(gate.push(0.05, t)).toEqual({ type: "speech-start" })

    t += 170
    expect(gate.push(0.001, t)).toBeNull()
    t += 700
    const event = gate.push(0.001, t)
    expect(event).toEqual({ type: "speech-end", speechMs: 300, discarded: false })
  })
})

describe("VadGate: floor freezes during speech (DoD 5)", () => {
  test("the noise floor does not adapt while inSpeech is true", () => {
    const gate = new VadGate(DEFAULT_VAD_GATE_CONFIG)
    feed(gate, 0.005, 30, 100)

    // The floor is allowed to drift during the pre-confirmation "candidate speech"
    // window (per spec: it updates while `!inSpeech`, which is still true up to and
    // including the sample that confirms speech-start) — that's expected. What must
    // NOT happen is any further drift once `inSpeech` is actually true.
    let t = 3000
    expect(gate.push(0.4, t)).toBeNull()
    t += 130
    expect(gate.push(0.4, t)).toEqual({ type: "speech-start" })
    const floorAtSpeechStart = gate.thresholds().floor

    // Feed a long loud run entirely inside confirmed speech: floor must stay put.
    for (let i = 0; i < 50; i++) {
      t += 50
      gate.push(0.4 + i * 0.001, t)
    }
    expect(gate.thresholds().floor).toBe(floorAtSpeechStart)
  })
})

describe("VadGate: config-driven behavior (DoD 6)", () => {
  test("the same level sequence yields different outcomes for different startMs configs", () => {
    const fast: VadGateConfig = { ...DEFAULT_VAD_GATE_CONFIG, startMs: 120 }
    const slow: VadGateConfig = { ...DEFAULT_VAD_GATE_CONFIG, startMs: 400 }
    const gateFast = new VadGate(fast)
    const gateSlow = new VadGate(slow)

    feed(gateFast, 0.001, 20, 10)
    feed(gateSlow, 0.001, 20, 10)

    const sequence = [0, 200] // 200ms sustained loud run: crosses 120ms, not 400ms
    let firedFast = false
    let firedSlow = false
    for (const dt of sequence) {
      const eFast = gateFast.push(0.05, 1000 + dt)
      const eSlow = gateSlow.push(0.05, 1000 + dt)
      if (eFast?.type === "speech-start") firedFast = true
      if (eSlow?.type === "speech-start") firedSlow = true
    }

    expect(firedFast).toBe(true)
    expect(firedSlow).toBe(false)
  })
})
