import { authTokenFromCredentials } from "./server"

export type MurfyMkdirServer = { url: string; username?: string; password?: string }

// murfy: fork addition (murfy-0sn) — calls the fork-only `POST /murfy/mkdir` route (see
// packages/opencode's server.ts) so "New Project" can create a real directory before ensure()-ing
// it into the sidebar. Raw fetch rather than the typed SDK client: the route is deliberately
// outside the declared HttpApi/OpenAPI contract, so no SDK regeneration is required.
export async function createMurfyDirectory(
  server: MurfyMkdirServer,
  path: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (server.password) headers.Authorization = `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`

  try {
    const response = await fetchImpl(new URL("/murfy/mkdir", server.url), {
      method: "POST",
      headers,
      body: JSON.stringify({ path }),
    })
    const body = await response.json().catch(() => undefined)
    // The route is a raw HttpRouter addition outside the SPA's client-routed paths, but on a
    // server that predates this route (not yet restarted with this fork's changes) a request
    // here 404s into the SPA's catch-all and gets back an HTML `index.html` with `status: 200`.
    // Require a well-formed JSON body confirming success rather than trusting `response.ok`
    // alone — otherwise a stale server silently "succeeds" without ever creating the directory.
    if (!response.ok || !body || typeof body !== "object" || body.ok !== true) {
      const error =
        body && typeof body === "object" && "error" in body ? String(body.error) : response.statusText || "request failed"
      return { ok: false, error }
    }
    return { ok: true }
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : "request failed" }
  }
}
