// Mic capture for dictation, with two paths:
//   - Safari: MediaRecorder produces mp4/AAC directly, which the STT server
//     accepts as-is.
//   - Everyone else (Chrome, Firefox, ...): MediaRecorder only offers
//     WebM/Opus, which the STT server cannot decode. Instead we tap raw PCM
//     via an AudioWorklet and encode a WAV file client-side.
// Both paths expose the same `MicCapture` interface so callers (dictation
// button now; PTT mode / voice-loop later) don't need to branch on browser.
import { concatFloat32, encodeWavMono } from "./wav-encoder"

export interface MicCapture {
  start(): Promise<void>
  /** Stops recording and resolves with the captured audio. Safe to await from a UI event handler. */
  stop(): Promise<Blob>
  isRecording(): boolean
  /** Releases the mic + audio graph without producing a result (e.g. unmount, error recovery). */
  cancel(): void
}

const WORKLET_NAME = "murfy-pcm-capture"

// Buffers ~4096 samples per postMessage to keep message overhead low without
// adding noticeable latency (roughly 85-250ms depending on the mic's native rate).
const WORKLET_SOURCE = `
class MurfyPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._chunks = []
    this._bufferedLength = 0
    this._chunkSize = 4096
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length) {
      this._chunks.push(channel.slice())
      this._bufferedLength += channel.length
      if (this._bufferedLength >= this._chunkSize) {
        const merged = new Float32Array(this._bufferedLength)
        let offset = 0
        for (const chunk of this._chunks) {
          merged.set(chunk, offset)
          offset += chunk.length
        }
        this.port.postMessage(merged, [merged.buffer])
        this._chunks = []
        this._bufferedLength = 0
      }
    }
    return true
  }
}
registerProcessor(${JSON.stringify(WORKLET_NAME)}, MurfyPcmCaptureProcessor)
`

function supportsDirectMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined
  for (const mimeType of ["audio/mp4", "audio/mp4;codecs=mp4a.40.2"]) {
    if (MediaRecorder.isTypeSupported(mimeType)) return mimeType
  }
  return undefined
}

class MediaRecorderCapture implements MicCapture {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []

  constructor(private mimeType: string) {}

  isRecording() {
    return this.recorder?.state === "recording"
  }

  async start() {
    if (this.isRecording()) return
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.chunks = []
    this.recorder = new MediaRecorder(this.stream, { mimeType: this.mimeType })
    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    }
    this.recorder.start()
  }

  stop(): Promise<Blob> {
    const recorder = this.recorder
    if (!recorder || recorder.state !== "recording") return Promise.resolve(new Blob())
    return new Promise((resolve) => {
      recorder.onstop = () => {
        this.stream?.getTracks().forEach((track) => track.stop())
        this.stream = null
        this.recorder = null
        resolve(new Blob(this.chunks, { type: recorder.mimeType || this.mimeType }))
      }
      recorder.stop()
    })
  }

  cancel() {
    this.recorder?.stream.getTracks().forEach((track) => track.stop())
    this.stream?.getTracks().forEach((track) => track.stop())
    this.recorder = null
    this.stream = null
    this.chunks = []
  }
}

class WorkletCapture implements MicCapture {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private silence: GainNode | null = null
  private chunks: Float32Array[] = []
  private recording = false

  isRecording() {
    return this.recording
  }

  async start() {
    if (this.recording) return
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.context = new AudioContext()
    const moduleUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }))
    try {
      await this.context.audioWorklet.addModule(moduleUrl)
    } finally {
      URL.revokeObjectURL(moduleUrl)
    }

    this.chunks = []
    this.source = this.context.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.context, WORKLET_NAME)
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.chunks.push(event.data)
    }
    // Route through a silent gain so the graph is "active" (required for the
    // worklet to be pulled) without echoing the mic to the speakers.
    this.silence = this.context.createGain()
    this.silence.gain.value = 0
    this.source.connect(this.node)
    this.node.connect(this.silence)
    this.silence.connect(this.context.destination)
    this.recording = true
  }

  private teardown() {
    this.source?.disconnect()
    this.node?.disconnect()
    this.silence?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    void this.context?.close()
    this.source = null
    this.node = null
    this.silence = null
    this.stream = null
    this.context = null
    this.recording = false
  }

  async stop(): Promise<Blob> {
    if (!this.recording || !this.context) return new Blob()
    const sampleRate = this.context.sampleRate
    const samples = concatFloat32(this.chunks)
    this.teardown()
    if (samples.length === 0) return new Blob()
    return encodeWavMono(samples, sampleRate)
  }

  cancel() {
    this.teardown()
  }
}

/** Picks the capture strategy for this browser. Safari gets direct mp4/AAC; everyone else gets AudioWorklet + WAV. */
export function createMicCapture(): MicCapture {
  const directMimeType = supportsDirectMimeType()
  if (directMimeType) return new MediaRecorderCapture(directMimeType)
  return new WorkletCapture()
}
