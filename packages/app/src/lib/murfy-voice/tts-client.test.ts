import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { synthesizeSpeech } from "./tts-client"

describe("synthesizeSpeech", () => {
  const OriginalFetch = globalThis.fetch
  let body: Record<string, unknown> | undefined

  beforeEach(() => {
    body = undefined
    globalThis.fetch = mock(async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    }) as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = OriginalFetch
  })

  test("includes speed in the POST body when opts.speed is set and !== 1", async () => {
    await synthesizeSpeech("Hello world.", undefined, { speed: 1.5 })
    expect(body?.speed).toBe(1.5)
    expect(body?.input).toBe("Hello world.")
  })

  test("omits speed key when opts are omitted", async () => {
    await synthesizeSpeech("Hello world.")
    expect(body).toBeDefined()
    expect("speed" in (body ?? {})).toBe(false)
  })

  test("omits speed key when speed === 1", async () => {
    await synthesizeSpeech("Hello world.", undefined, { speed: 1 })
    expect(body).toBeDefined()
    expect("speed" in (body ?? {})).toBe(false)
  })
})
