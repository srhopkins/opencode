import { describe, expect, test } from "bun:test"
import { concatFloat32, encodeWavMono } from "./wav-encoder"

describe("encodeWavMono", () => {
  test("writes a valid 16-bit mono PCM WAV header", async () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1])
    const blob = encodeWavMono(samples, 16000)
    const buffer = await blob.arrayBuffer()
    const view = new DataView(buffer)

    expect(buffer.byteLength).toBe(44 + samples.length * 2)
    expect(String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))).toBe("RIFF")
    expect(String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11))).toBe("WAVE")
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16000) // sample rate
    expect(view.getUint16(34, true)).toBe(16) // bits per sample
    expect(view.getUint32(40, true)).toBe(samples.length * 2) // data chunk size
  })

  test("clamps out-of-range samples instead of overflowing", async () => {
    const samples = new Float32Array([2, -2])
    const blob = encodeWavMono(samples, 8000)
    const buffer = await blob.arrayBuffer()
    const view = new DataView(buffer)
    expect(view.getInt16(44, true)).toBe(0x7fff)
    expect(view.getInt16(46, true)).toBe(-0x8000)
  })
})

describe("concatFloat32", () => {
  test("concatenates chunks in order", () => {
    const result = concatFloat32([new Float32Array([1, 2]), new Float32Array([3]), new Float32Array([4, 5])])
    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5])
  })

  test("handles empty input", () => {
    expect(concatFloat32([]).length).toBe(0)
  })
})
