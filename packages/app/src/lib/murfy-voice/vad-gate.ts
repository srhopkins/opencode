// Pure VAD (voice-activity-detection) state machine: zero browser APIs, driven by
// discrete (level, timestamp) samples pushed by the caller (use-voice-loop.ts).
// Adaptive noise-floor gate, per the anti-Hermes lesson: hardcoded absolute
// thresholds don't survive a change of room/mic, so both the start and stop
// thresholds track an EWMA estimate of the ambient noise floor, with a hard
// minimum floor so an unusually quiet room doesn't make the gate hair-trigger.

export interface VadGateConfig {
  startMult: number
  stopMult: number
  startFloorMin: number
  stopFloorMin: number
  startMs: number
  stopMs: number
  minSpeechMs: number
  prerollMs: number
  floorAlpha?: number
}

export const DEFAULT_VAD_GATE_CONFIG: VadGateConfig = {
  startMult: 3,
  stopMult: 1.8,
  startFloorMin: 0.015,
  stopFloorMin: 0.01,
  startMs: 120,
  stopMs: 700,
  minSpeechMs: 250,
  prerollMs: 300,
  floorAlpha: 0.05,
}

export type VadGateEvent =
  | { type: "speech-start" }
  | { type: "speech-end"; speechMs: number; discarded: boolean }
  | null

export class VadGate {
  private readonly config: VadGateConfig
  private readonly floorAlpha: number
  private floor = 0
  private floorInitialized = false
  private inSpeech = false
  private speechStartAtMs: number | null = null
  // Continuous-run trackers: `aboveSinceMs` while gauging whether a loud run has
  // sustained `startMs` (pre-speech); `belowSinceMs` while gauging whether a quiet
  // run has sustained `stopMs` (mid-speech). Reset to null on any dip below/above
  // threshold so brief spikes/dips never fire a boundary on their own.
  private aboveSinceMs: number | null = null
  private belowSinceMs: number | null = null

  constructor(config: VadGateConfig) {
    this.config = config
    this.floorAlpha = config.floorAlpha ?? 0.05
  }

  push(level: number, atMs: number): VadGateEvent {
    if (!this.inSpeech) {
      if (!this.floorInitialized) {
        this.floor = level
        this.floorInitialized = true
      } else {
        this.floor += this.floorAlpha * (level - this.floor)
      }

      const startThreshold = Math.max(this.floor * this.config.startMult, this.config.startFloorMin)
      if (level > startThreshold) {
        if (this.aboveSinceMs === null) this.aboveSinceMs = atMs
        if (atMs - this.aboveSinceMs >= this.config.startMs) {
          this.inSpeech = true
          // Backdate the confirmed start to when the loud run actually began, not
          // to the (later) confirmation instant, so minSpeechMs measures real
          // speech duration rather than "duration since we became confident".
          this.speechStartAtMs = this.aboveSinceMs
          this.aboveSinceMs = null
          this.belowSinceMs = null
          return { type: "speech-start" }
        }
      } else {
        this.aboveSinceMs = null
      }
      return null
    }

    const stopThreshold = Math.max(this.floor * this.config.stopMult, this.config.stopFloorMin)
    if (level < stopThreshold) {
      if (this.belowSinceMs === null) this.belowSinceMs = atMs
      if (atMs - this.belowSinceMs >= this.config.stopMs) {
        // speechMs excludes the trailing silence: measured start-of-speech to the
        // moment the trailing quiet run began, not to the (later) confirmation instant.
        const speechEndAtMs = this.belowSinceMs
        const speechMs = speechEndAtMs - (this.speechStartAtMs ?? speechEndAtMs)
        const discarded = speechMs < this.config.minSpeechMs
        this.inSpeech = false
        this.speechStartAtMs = null
        this.belowSinceMs = null
        this.aboveSinceMs = null
        return { type: "speech-end", speechMs, discarded }
      }
    } else {
      this.belowSinceMs = null
    }
    return null
  }

  thresholds(): { start: number; stop: number; floor: number } {
    return {
      start: Math.max(this.floor * this.config.startMult, this.config.startFloorMin),
      stop: Math.max(this.floor * this.config.stopMult, this.config.stopFloorMin),
      floor: this.floor,
    }
  }

  reset(): void {
    this.floor = 0
    this.floorInitialized = false
    this.inSpeech = false
    this.speechStartAtMs = null
    this.aboveSinceMs = null
    this.belowSinceMs = null
  }
}
