import { describe, expect, test } from "bun:test"
import { createMurfyDirectory } from "./murfy-mkdir"

function fakeFetch(handler: (request: Request) => Response) {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    return handler(request)
  }) as typeof globalThis.fetch
}

describe("createMurfyDirectory", () => {
  test("posts the target path with Basic auth when the server has a password", async () => {
    let seen: { url: string; method: string; auth: string | null; body: unknown } | undefined
    const fetchImpl = fakeFetch((request) => {
      seen = { url: request.url, method: request.method, auth: request.headers.get("Authorization"), body: undefined }
      return new Response(JSON.stringify({ ok: true, path: "/home/steve/murfy/projects/demo" }), { status: 200 })
    })

    const result = await createMurfyDirectory(
      { url: "http://localhost:4096", username: "opencode", password: "secret" },
      "/home/steve/murfy/projects/demo",
      fetchImpl,
    )

    expect(result).toEqual({ ok: true })
    expect(seen?.url).toBe("http://localhost:4096/murfy/mkdir")
    expect(seen?.method).toBe("POST")
    expect(seen?.auth).toBe(`Basic ${btoa("opencode:secret")}`)
  })

  test("omits Authorization when the server has no password", async () => {
    let auth: string | null = "unset"
    const fetchImpl = fakeFetch((request) => {
      auth = request.headers.get("Authorization")
      return new Response(JSON.stringify({ ok: true }), { status: 200 })
    })

    await createMurfyDirectory({ url: "http://localhost:4096" }, "/home/steve/murfy/projects/demo", fetchImpl)

    expect(auth).toBeNull()
  })

  test("surfaces the server error message on a non-ok response", async () => {
    const fetchImpl = fakeFetch(
      () => new Response(JSON.stringify({ ok: false, error: "path must be a directory under the home directory" }), { status: 400 }),
    )

    const result = await createMurfyDirectory({ url: "http://localhost:4096" }, "/etc/demo", fetchImpl)

    expect(result).toEqual({ ok: false, error: "path must be a directory under the home directory" })
  })

  test("falls back to the status text when the error body isn't JSON", async () => {
    const fetchImpl = fakeFetch(() => new Response("boom", { status: 500, statusText: "Internal Server Error" }))

    const result = await createMurfyDirectory({ url: "http://localhost:4096" }, "/home/steve/murfy/projects/demo", fetchImpl)

    expect(result).toEqual({ ok: false, error: "Internal Server Error" })
  })

  test("treats a 200 OK non-JSON body (e.g. the SPA's catch-all route on a server that " + "predates /murfy/mkdir) as a failure rather than a false success", async () => {
    const fetchImpl = fakeFetch(() => new Response("<!doctype html>...", { status: 200, statusText: "OK" }))

    const result = await createMurfyDirectory({ url: "http://localhost:4096" }, "/home/steve/murfy/projects/demo", fetchImpl)

    expect(result.ok).toBe(false)
  })

  test("treats a 200 OK JSON body without ok:true as a failure", async () => {
    const fetchImpl = fakeFetch(() => new Response(JSON.stringify({ unexpected: true }), { status: 200 }))

    const result = await createMurfyDirectory({ url: "http://localhost:4096" }, "/home/steve/murfy/projects/demo", fetchImpl)

    expect(result.ok).toBe(false)
  })

  test("catches a thrown fetch error", async () => {
    const fetchImpl = (async () => {
      throw new Error("network down")
    }) as unknown as typeof globalThis.fetch

    const result = await createMurfyDirectory({ url: "http://localhost:4096" }, "/home/steve/murfy/projects/demo", fetchImpl)

    expect(result).toEqual({ ok: false, error: "network down" })
  })
})
