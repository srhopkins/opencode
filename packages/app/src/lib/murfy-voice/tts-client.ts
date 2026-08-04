import { MurfyVoiceConfig } from "./config"

/** Synthesizes speech for one sentence (or small group) of text. Returns WAV bytes. */
export async function synthesizeSpeech(
  text: string,
  signal?: AbortSignal,
  opts?: { speed?: number },
): Promise<Blob> {
  const body: Record<string, unknown> = {
    model: MurfyVoiceConfig.ttsModel,
    voice: MurfyVoiceConfig.ttsVoice,
    input: text,
    response_format: "wav",
  }
  // Omit speed when unset or 1 so the server uses its default (no time-stretch).
  if (opts?.speed !== undefined && opts.speed !== 1) {
    body.speed = opts.speed
  }

  const response = await fetch(`${MurfyVoiceConfig.ttsUrl}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })
  if (!response.ok) {
    throw new Error(`TTS request failed: ${response.status} ${await response.text().catch(() => "")}`)
  }
  return response.blob()
}
