// Prepares assistant reply text for TTS: strip markdown/code (we don't want
// the voice reading out "asterisk asterisk bold asterisk asterisk"), then
// split into sentence-sized chunks so playback can start before the whole
// reply has streamed in and finished. Optional comma splitting inserts
// shorter seams (gapAfterMs) between long clauses.

const CODE_BLOCK_SPOKEN_PLACEHOLDER = " Code block. "

export interface SpeechChunk {
  text: string
  /** Silence after this chunk finishes, before the next starts (comma seams). */
  gapAfterMs?: number
}

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

function wordCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).length
}

/** True when the comma at `index` is a thousands-separator between digits (e.g. 1,000). */
function isNumericComma(text: string, index: number): boolean {
  const prev = text[index - 1]
  const next = text[index + 1]
  return prev !== undefined && next !== undefined && /\d/.test(prev) && /\d/.test(next)
}

/**
 * Split one sentence at commas where both resulting sides have ≥ minWords words.
 * Puts `commaGapMs` on the chunk before each seam; the final fragment has no gapAfterMs.
 */
function splitSentenceAtCommas(sentence: string, minWords: number, commaGapMs: number): SpeechChunk[] {
  for (let i = 0; i < sentence.length; i++) {
    if (sentence[i] !== "," || isNumericComma(sentence, i)) continue
    const left = sentence.slice(0, i).trim()
    const right = sentence.slice(i + 1).trim()
    if (wordCount(left) < minWords || wordCount(right) < minWords) continue
    const rest = splitSentenceAtCommas(right, minWords, commaGapMs)
    return [{ text: left, gapAfterMs: commaGapMs }, ...rest]
  }
  return [{ text: sentence }]
}

/**
 * Strip markdown, split into speech chunks. With no opts (or commaSplitMinWords
 * undefined/0): sentence chunks only, no gapAfterMs — legacy behavior.
 */
export function textToSpeechChunks(
  text: string,
  opts?: { commaSplitMinWords?: number; commaGapMs?: number },
): SpeechChunk[] {
  const sentences = splitIntoSentences(stripMarkdownForSpeech(text))
  const minWords = opts?.commaSplitMinWords ?? 0
  if (minWords < 1) {
    return sentences.map((sentence) => ({ text: sentence }))
  }
  const commaGapMs = opts?.commaGapMs ?? 250
  const chunks: SpeechChunk[] = []
  for (const sentence of sentences) {
    chunks.push(...splitSentenceAtCommas(sentence, minWords, commaGapMs))
  }
  return chunks
}
