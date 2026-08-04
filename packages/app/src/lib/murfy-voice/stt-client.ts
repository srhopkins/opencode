import { MurfyVoiceConfig } from "./config"

/** Sends recorded audio to the STT server. OpenAI-compatible multipart endpoint. */
export async function transcribeAudio(audio: Blob): Promise<string> {
  if (audio.size === 0) return ""

  const extension = audio.type.includes("mp4") ? "m4a" : audio.type.includes("wav") ? "wav" : "webm"
  const form = new FormData()
  form.append("file", audio, `dictation.${extension}`)
  form.append("model", MurfyVoiceConfig.sttModel)

  const response = await fetch(`${MurfyVoiceConfig.sttUrl}/v1/audio/transcriptions`, {
    method: "POST",
    body: form,
  })
  if (!response.ok) {
    throw new Error(`STT request failed: ${response.status} ${await response.text().catch(() => "")}`)
  }
  const data = (await response.json()) as { text?: string }
  return (data.text ?? "").trim()
}
