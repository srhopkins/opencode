import { describe, expect, test } from "bun:test"
import { splitIntoSentences, stripMarkdownForSpeech, textToSpeechChunks } from "./text-split"

describe("stripMarkdownForSpeech", () => {
  test("replaces fenced code blocks with a spoken placeholder", () => {
    const input = "Here is some code:\n\n```ts\nconst x = 1\n```\n\nDone."
    const out = stripMarkdownForSpeech(input)
    expect(out).not.toContain("```")
    expect(out).not.toContain("const x")
    expect(out).toContain("Code block.")
  })

  test("unwraps inline code and links", () => {
    const out = stripMarkdownForSpeech("Run `npm install` then see [the docs](https://example.com).")
    expect(out).toBe("Run npm install then see the docs.")
  })

  test("strips bold, italics, and headers", () => {
    const out = stripMarkdownForSpeech("# Title\n\nThis is **bold** and *italic* text.")
    expect(out).toBe("Title\n\nThis is bold and italic text.")
  })

  test("strips bullet and numbered list markers", () => {
    const out = stripMarkdownForSpeech("- first\n- second\n1. one\n2. two")
    expect(out).toBe("first\nsecond\none\ntwo")
  })

  test("replaces images with a spoken word", () => {
    const out = stripMarkdownForSpeech("Look: ![a cat](cat.png)")
    expect(out).toBe("Look: image")
  })
})

describe("splitIntoSentences", () => {
  test("splits on sentence boundaries", () => {
    const out = splitIntoSentences("First sentence. Second sentence! Third one?")
    expect(out).toEqual(["First sentence.", "Second sentence!", "Third one?"])
  })

  test("treats paragraphs as separate boundaries", () => {
    const out = splitIntoSentences("Paragraph one.\n\nParagraph two.")
    expect(out).toEqual(["Paragraph one.", "Paragraph two."])
  })

  test("returns empty array for blank input", () => {
    expect(splitIntoSentences("   \n\n  ")).toEqual([])
  })
})

describe("textToSpeechChunks", () => {
  test("strips markdown then splits into sentences", () => {
    const out = textToSpeechChunks("**Hello.** This has `code` and a [link](url). Bye.")
    expect(out).toEqual([{ text: "Hello." }, { text: "This has code and a link." }, { text: "Bye." }])
  })

  test("legacy behavior when commaSplitMinWords is 0 or omitted", () => {
    const text = "We considered the options, and after a long discussion we decided to proceed carefully."
    const legacy = textToSpeechChunks(text)
    const off = textToSpeechChunks(text, { commaSplitMinWords: 0 })
    expect(off).toEqual(legacy)
    expect(legacy).toEqual([{ text }])
    expect(legacy[0]?.gapAfterMs).toBeUndefined()
  })

  test("splits at comma when both sides meet min words", () => {
    // Left=4 words, right=10 — both ≥4. (DoD fixture; threshold matches both-sides rule.)
    const text = "We considered the options, and after a long discussion we decided to proceed carefully."
    const out = textToSpeechChunks(text, { commaSplitMinWords: 4, commaGapMs: 250 })
    expect(out).toEqual([
      { text: "We considered the options", gapAfterMs: 250 },
      { text: "and after a long discussion we decided to proceed carefully." },
    ])
  })

  test("does not split short clauses (Yes, we did.)", () => {
    const out = textToSpeechChunks("Yes, we did.", { commaSplitMinWords: 6, commaGapMs: 250 })
    expect(out).toEqual([{ text: "Yes, we did." }])
  })

  test("splits at real comma only; leaves numeric commas intact", () => {
    // Left of real comma = 5 words ("The budget is 1,000 dollars"), right = 8.
    const text = "The budget is 1,000 dollars, which everyone on the finance team accepted happily."
    const out = textToSpeechChunks(text, { commaSplitMinWords: 5, commaGapMs: 250 })
    expect(out).toEqual([
      { text: "The budget is 1,000 dollars", gapAfterMs: 250 },
      { text: "which everyone on the finance team accepted happily." },
    ])
    expect(out[0]?.text).toContain("1,000")
  })

  test("both sides ≥6 words with default-style minWords", () => {
    const text =
      "We considered all of the available options, and after a long discussion we decided to proceed carefully."
    const out = textToSpeechChunks(text, { commaSplitMinWords: 6, commaGapMs: 250 })
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ text: "We considered all of the available options", gapAfterMs: 250 })
    expect(out[1]?.text).toBe("and after a long discussion we decided to proceed carefully.")
    expect(out[1]?.gapAfterMs).toBeUndefined()
  })

  test("does not split 12,345,678 style numbers", () => {
    const text = "The total was 12,345,678 dollars, which everyone on the finance team accepted happily."
    const out = textToSpeechChunks(text, { commaSplitMinWords: 5, commaGapMs: 200 })
    expect(out[0]?.text).toContain("12,345,678")
    expect(out).toHaveLength(2)
  })
})
