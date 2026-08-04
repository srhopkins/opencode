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
    expect(out).toEqual(["Hello.", "This has code and a link.", "Bye."])
  })
})
