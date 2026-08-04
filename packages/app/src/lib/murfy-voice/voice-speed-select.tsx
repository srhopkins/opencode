// TTS playback speed dropdown, on the composer bar. Plain native <select> —
// simple, works identically in both composer layouts without depending on
// either layout's Kobalte-based Select/SelectV2 wrapper, and is trivial to
// drive from Playwright/devtools for eval testing.
import { For, type Accessor } from "solid-js"

const SPEED_OPTIONS = [0.8, 1, 1.2, 1.5, 1.75, 2] as const

export function VoiceSpeedSelect(props: { speed: Accessor<number>; onChange: (speed: number) => void }) {
  return (
    <select
      aria-label="TTS playback speed"
      data-testid="voice-speed-select"
      class="h-7 rounded-md border border-border-weak-base bg-transparent px-1.5 text-12-regular text-text-base outline-none"
      value={String(props.speed())}
      onChange={(e) => props.onChange(Number(e.currentTarget.value))}
    >
      <For each={SPEED_OPTIONS}>{(speed) => <option value={String(speed)}>{speed}×</option>}</For>
    </select>
  )
}
