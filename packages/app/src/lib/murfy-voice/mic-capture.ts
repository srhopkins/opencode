// Mic capture for dictation / PTT: AudioWorklet → PCM → WAV client-side.
// Chrome on macOS advertises MediaRecorder `audio/mp4`, but macos-speech-server
// (FluidAudio) cannot decode those m4a uploads (500 / OSStatus -1). WAV is the
// verified path against :8766 — always use it.
import { concatFloat32, encodeWavMono } from "./wav-encoder"

export interface MicCaptureStartOptions {
  /** Called once per worklet PCM chunk with that chunk's RMS (0..1). */
  onLevel?: (rms: number) => void
}

export interface MicCapture {
  start(opts?: MicCaptureStartOptions): Promise<void>
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

/** RMS of float PCM samples, clamped to 0..1. Pure helper for metering + tests. */
export function rmsLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sumSquares = 0
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i]!
    sumSquares += s * s
  }
  const rms = Math.sqrt(sumSquares / samples.length)
  if (rms <= 0) return 0
  if (rms >= 1) return 1
  return rms
}

/** Store one worklet PCM chunk and optionally report its RMS level. */
export function handleWorkletPcmMessage(
  data: Float32Array,
  chunks: Float32Array[],
  onLevel?: (rms: number) => void,
): void {
  chunks.push(data)
  onLevel?.(rmsLevel(data))
}

class WorkletCapture implements MicCapture {
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private silence: GainNode | null = null
  private chunks: Float32Array[] = []
  private recording = false
  private onLevel: ((rms: number) => void) | undefined

  isRecording() {
    return this.recording
  }

  async start(opts?: MicCaptureStartOptions) {
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
    this.onLevel = opts?.onLevel
    this.source = this.context.createMediaStreamSource(this.stream)
    this.node = new AudioWorkletNode(this.context, WORKLET_NAME)
    this.node.port.onmessage = (event: MessageEvent<Float32Array>) => {
      handleWorkletPcmMessage(event.data, this.chunks, this.onLevel)
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
    this.onLevel = undefined
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

/** Always AudioWorklet → WAV (see file header). */
export function createMicCapture(): MicCapture {
  return new WorkletCapture()
}
