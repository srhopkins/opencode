// Config for murfy's composer voice features (dictation + auto-read).
// Base URLs point at Steve's local speech-server proxies:
//   :8766 -> avspeech engine (used here for STT)
//   :8768 -> Kokoro engine (used here for TTS, default voice af_nova)
// Both are OpenAI-compatible (`/v1/audio/transcriptions`, `/v1/audio/speech`).
// Override any of these at runtime via localStorage (e.g. from devtools):
//   localStorage.setItem("murfy.voice.sttUrl", "http://127.0.0.1:8766")

const DEFAULTS = {
  sttUrl: "http://127.0.0.1:8766",
  ttsUrl: "http://127.0.0.1:8768",
  ttsVoice: "af_nova",
  ttsModel: "tts-1",
  sttModel: "whisper-1",
}

function readOverride(key: string): string | undefined {
  try {
    return localStorage.getItem(`murfy.voice.${key}`) ?? undefined
  } catch {
    return undefined
  }
}

function setting(key: keyof typeof DEFAULTS): string {
  return readOverride(key) ?? DEFAULTS[key]
}

export const MurfyVoiceConfig = {
  get sttUrl() {
    return setting("sttUrl").replace(/\/$/, "")
  },
  get ttsUrl() {
    return setting("ttsUrl").replace(/\/$/, "")
  },
  get ttsVoice() {
    return setting("ttsVoice")
  },
  get ttsModel() {
    return setting("ttsModel")
  },
  get sttModel() {
    return setting("sttModel")
  },
}
