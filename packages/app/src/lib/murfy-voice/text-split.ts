// Prepares assistant reply text for TTS: strip markdown/code (we don't want
// the voice reading out "asterisk asterisk bold asterisk asterisk"), then
// split into sentence-sized chunks so playback can start before the whole
// reply has streamed in and finished.

const CODE_BLOCK_SPOKEN_PLACEHOLDER = " Code block. "

export function stripMarkdownForSpeech(text: string): string {
  let out = text

  // Fenced code blocks first (so their contents aren't touched by the rules below).
  out = out.replace(/```[\s\S]*?```/g, CODE_BLOCK_SPOKEN_PLACEHOLDER)
  out = out.replace(/~~~[\s\S]*?~~~/g, CODE_BLOCK_SPOKEN_PLACEHOLDER)

  // Images before links (both start with `[...]`, images are prefixed with `!`).
  out = out.replace(/!\[[^\]]*\]\([^)]*\)/g, " image ")
  out = out.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")

  out = out.replace(/`([^`]+)`/g, "$1")
  out = out.replace(/^#{1,6}\s+/gm, "")
  out = out.replace(/(\*\*|__)(.*?)\1/g, "$2")
  out = out.replace(/(\*|_)(.*?)\1/g, "$2")
  out = out.replace(/^>\s?/gm, "")
  out = out.replace(/^[ \t]*[-*+][ \t]+/gm, "")
  out = out.replace(/^[ \t]*\d+\.[ \t]+/gm, "")
  out = out.replace(/^[ \t]*-{3,}[ \t]*$/gm, "")

  return out.replace(/[ \t]+/g, " ").trim()
}

/** Splits stripped text into sentence-ish chunks suitable for individual TTS requests. */
export function splitIntoSentences(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  const sentences: string[] = []
  for (const paragraph of paragraphs) {
    const collapsed = paragraph.replace(/\s+/g, " ").trim()
    if (!collapsed) continue
    const parts = collapsed.split(/(?<=[.!?])\s+(?=\S)/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed) sentences.push(trimmed)
    }
  }
  return sentences
}

/** Combines strip + split for convenience. */
export function textToSpeechChunks(text: string): string[] {
  return splitIntoSentences(stripMarkdownForSpeech(text))
}
