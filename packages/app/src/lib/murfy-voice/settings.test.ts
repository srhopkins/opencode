import { describe, expect, test } from "bun:test"
import {
  createCommaGapMsSetting,
  createCommaSplitMinWordsSetting,
  createSentenceGapMsSetting,
  createTtsSpeedSetting,
} from "./settings"

describe("prosody settings defaults", () => {
  test("ttsSpeed defaults to 1", () => {
    localStorage.removeItem("murfy.voice.ttsSpeed")
    const [value] = createTtsSpeedSetting()
    expect(value()).toBe(1)
  })

  test("sentenceGapMs defaults to 450", () => {
    localStorage.removeItem("murfy.voice.sentenceGapMs")
    const [value] = createSentenceGapMsSetting()
    expect(value()).toBe(450)
  })

  test("commaGapMs defaults to 250", () => {
    localStorage.removeItem("murfy.voice.commaGapMs")
    const [value] = createCommaGapMsSetting()
    expect(value()).toBe(250)
  })

  test("commaSplitMinWords defaults to 6", () => {
    localStorage.removeItem("murfy.voice.commaSplitMinWords")
    const [value] = createCommaSplitMinWordsSetting()
    expect(value()).toBe(6)
  })

  test("persists ttsSpeed to localStorage", () => {
    localStorage.removeItem("murfy.voice.ttsSpeed")
    const [value, setValue] = createTtsSpeedSetting()
    setValue(1.5)
    expect(value()).toBe(1.5)
    expect(localStorage.getItem("murfy.voice.ttsSpeed")).toBe("1.5")
  })
})
