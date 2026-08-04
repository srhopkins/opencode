import { describe, expect, test } from "bun:test"
import { handleWorkletPcmMessage, rmsLevel } from "./mic-capture"

describe("rmsLevel", () => {
  test("all-zeros chunk → 0", () => {
    const samples = new Float32Array(4096)
    expect(rmsLevel(samples)).toBeCloseTo(0, 3)
  })

  test("full-scale ±1.0 square wave → 1.0 (clamped)", () => {
    const samples = new Float32Array(512)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i % 2 === 0 ? 1 : -1
    }
    expect(rmsLevel(samples)).toBeCloseTo(1.0, 2)

    // Over-unity samples prove the upper clamp.
    const hot = new Float32Array(64)
    hot.fill(2)
    expect(rmsLevel(hot)).toBe(1)
  })

  test("0.5-amplitude sine → ~0.354", () => {
    const n = 2048
    const samples = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      samples[i] = 0.5 * Math.sin((2 * Math.PI * i) / n)
    }
    // RMS of A·sin = A/√2 ≈ 0.35355
    expect(rmsLevel(samples)).toBeCloseTo(0.354, 1)
    expect(Math.abs(rmsLevel(samples) - 0.5 / Math.SQRT2)).toBeLessThan(0.02)
  })
})

describe("handleWorkletPcmMessage / onLevel", () => {
  test("invokes onLevel once per chunk message", () => {
    const chunks: Float32Array[] = []
    const levels: number[] = []
    const a = new Float32Array([0.1, -0.1, 0.1, -0.1])
    const b = new Float32Array([0, 0, 0, 0])
    const c = new Float32Array(8)
    for (let i = 0; i < c.length; i++) c[i] = i % 2 === 0 ? 1 : -1

    handleWorkletPcmMessage(a, chunks, (rms) => levels.push(rms))
    handleWorkletPcmMessage(b, chunks, (rms) => levels.push(rms))
    handleWorkletPcmMessage(c, chunks, (rms) => levels.push(rms))

    expect(levels.length).toBe(3)
    expect(chunks.length).toBe(3)
    expect(chunks[0]).toBe(a)
    expect(chunks[1]).toBe(b)
    expect(chunks[2]).toBe(c)
    expect(levels[0]).toBeCloseTo(rmsLevel(a), 5)
    expect(levels[1]).toBeCloseTo(0, 3)
    expect(levels[2]).toBeCloseTo(1, 2)
  })

  test("skips callback when onLevel is omitted", () => {
    const chunks: Float32Array[] = []
    handleWorkletPcmMessage(new Float32Array([1, -1]), chunks)
    expect(chunks.length).toBe(1)
  })
})
