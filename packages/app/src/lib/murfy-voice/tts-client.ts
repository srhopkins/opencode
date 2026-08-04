import { MurfyVoiceConfig } from "./config"

/** Synthesizes speech for one sentence (or small group) of text. Returns WAV bytes. */
export async function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(`${MurfyVoiceConfig.ttsUrl}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MurfyVoiceConfig.ttsModel,
      voice: MurfyVoiceConfig.ttsVoice,
      input: text,
      response_format: "wav",
    }),
    signal,
  })
  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status} ${await response.text().catch(() => "")}`)
  }
  return response.blob()
}
