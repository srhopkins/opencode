// Watches the currently-viewed session's message store and speaks each
// assistant reply as soon as it's marked complete (`message.time.completed`
// is the authoritative "this turn is done" signal from the session data
// layer — see AssistantMessage in @opencode-ai/sdk/v2). Never reads history:
// switching to a session seeds a baseline of already-completed messages
// before watching for new completions.
import { createEffect, onCleanup, type Accessor } from "solid-js"
import type { Message, Part } from "@opencode-ai/sdk/v2/client"
import type { DirectorySync } from "@/context/sync"
import { SpeechQueue } from "./playback"

function isCompletedAssistant(message: Message): boolean {
  return message.role === "assistant" && typeof message.time.completed === "number"
}

function extractSpeakableText(parts: Part[] | undefined): string {
  if (!parts) return ""
  return parts
    .filter((part): part is Extract<Part, { type: "text" }> => part.type === "text" && !part.ignored)
    .map((part) => part.text)
    .join("\n\n")
    .trim()
}

export function createAutoReadReplies(options: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
  enabled: Accessor<boolean>
}) {
  const queue = new SpeechQueue()
  const spokenBySession = new Map<string, Set<string>>()
  // Set by PTT (armForceRead) right before an auto-sent message goes out: the very
  // next completed assistant message is spoken regardless of `enabled`, since PTT is
  // a hands-free loop independent of the global auto-read toggle. A plain counter
  // (not per-session) is enough because PTT only operates on the currently-viewed
  // session; it's consumed by whichever completed message arrives next, so it can
  // occasionally attribute a force-read to an unrelated in-flight reply rather than
  // the PTT turn specifically, but sessions normally process one turn at a time.
  let forcePending = 0

  const seenFor = (sessionID: string) => {
    let set = spokenBySession.get(sessionID)
    if (!set) {
      set = new Set()
      spokenBySession.set(sessionID, set)
    }
    return set
  }

  // Seed a baseline whenever the viewed session changes so history is never read,
  // even if a reply finished while the user was looking at a different session.
  createEffect<string | undefined>((prevSessionID) => {
    const sessionID = options.sessionID()
    if (sessionID && sessionID !== prevSessionID) {
      queue.stop()
      const messages = options.sync().data.message[sessionID] ?? []
      const seen = seenFor(sessionID)
      for (const message of messages) {
        if (isCompletedAssistant(message)) seen.add(message.id)
      }
    }
    return sessionID
  }, undefined)

  createEffect(() => {
    const sessionID = options.sessionID()
    if (!sessionID) return
    const sync = options.sync()
    const messages = sync.data.message[sessionID] ?? []
    const seen = seenFor(sessionID)
    const enabled = options.enabled()
    for (const message of messages) {
      if (!isCompletedAssistant(message)) continue
      if (seen.has(message.id)) continue
      // Always mark seen, even when skipping speech below: otherwise a reply that
      // completes while auto-read is off would incorrectly get read aloud later,
      // the next time auto-read is toggled back on.
      seen.add(message.id)
      const forced = forcePending > 0
      if (forced) forcePending -= 1
      if (!enabled && !forced) continue
      const text = extractSpeakableText(sync.data.part[message.id])
      if (text) queue.enqueueText(text)
    }
  })

  createEffect(() => {
    if (!options.enabled() && forcePending === 0) queue.stop()
  })

  onCleanup(() => queue.stop())

  return {
    stop: () => queue.stop(),
    isSpeaking: () => queue.isSpeaking(),
    /** Arms a one-time override so the next completed assistant reply is spoken
     * even if `enabled` is currently false. Used by PTT right before auto-sending. */
    armForceRead: () => {
      forcePending += 1
    },
  }
}
