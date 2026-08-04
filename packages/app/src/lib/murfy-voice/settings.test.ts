import { beforeEach, describe, expect, test } from "bun:test"
import { DEFAULT_VAD_GATE_CONFIG } from "./vad-gate"
import {
  __resetVoiceSettingsRegistryForTests,
  createCommaGapMsSetting,
  createCommaSplitMinWordsSetting,
  createSentenceGapMsSetting,
  createTtsSpeedSetting,
  createVadGateConfigSetting,
  createVadStartMsSetting,
  createVoiceModeSetting,
} from "./settings"

// Every test starts from a clean singleton cache (see settings.ts's registry
// comment) so a signal created in one test never leaks into the next.
beforeEach(() => __resetVoiceSettingsRegistryForTests())

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

describe("voice mode setting", () => {
  test("defaults to ptt", () => {
    localStorage.removeItem("murfy.voice.mode")
    const [mode] = createVoiceModeSetting()
    expect(mode()).toBe("ptt")
  })

  test("persists mode changes", () => {
    localStorage.removeItem("murfy.voice.mode")
    const [mode, setMode] = createVoiceModeSetting()
    setMode("vad")
    expect(mode()).toBe("vad")
    expect(localStorage.getItem("murfy.voice.mode")).toBe("vad")
  })

  test("repeated calls share one live signal within a tab", () => {
    localStorage.removeItem("murfy.voice.mode")
    const [modeA, setModeA] = createVoiceModeSetting()
    const [modeB] = createVoiceModeSetting()
    setModeA("vad")
    expect(modeB()).toBe("vad")
  })
})

describe("VAD gate config setting", () => {
  test("defaults match DEFAULT_VAD_GATE_CONFIG", () => {
    for (const key of [
      "murfy.voice.vad.startMult",
      "murfy.voice.vad.stopMult",
      "murfy.voice.vad.startFloorMin",
      "murfy.voice.vad.stopFloorMin",
      "murfy.voice.vad.startMs",
      "murfy.voice.vad.stopMs",
      "murfy.voice.vad.minSpeechMs",
      "murfy.voice.vad.prerollMs",
    ]) {
      localStorage.removeItem(key)
    }
    const getConfig = createVadGateConfigSetting()
    expect(getConfig()).toEqual({
      startMult: DEFAULT_VAD_GATE_CONFIG.startMult,
      stopMult: DEFAULT_VAD_GATE_CONFIG.stopMult,
      startFloorMin: DEFAULT_VAD_GATE_CONFIG.startFloorMin,
      stopFloorMin: DEFAULT_VAD_GATE_CONFIG.stopFloorMin,
      startMs: DEFAULT_VAD_GATE_CONFIG.startMs,
      stopMs: DEFAULT_VAD_GATE_CONFIG.stopMs,
      minSpeechMs: DEFAULT_VAD_GATE_CONFIG.minSpeechMs,
      prerollMs: DEFAULT_VAD_GATE_CONFIG.prerollMs,
      floorAlpha: DEFAULT_VAD_GATE_CONFIG.floorAlpha,
    })
  })

  test("a slider edit is reflected immediately in a freshly composed config getter", () => {
    localStorage.removeItem("murfy.voice.vad.startMs")
    const [, setStartMs] = createVadStartMsSetting()
    setStartMs(400)
    const getConfig = createVadGateConfigSetting()
    expect(getConfig().startMs).toBe(400)
  })
})
