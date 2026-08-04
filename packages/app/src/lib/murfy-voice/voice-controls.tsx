// Composer toolbar controls for murfy voice phase A (legacy v1 layout): a mic
// button for dictation-to-draft and a speaker toggle for auto-reading
// completed replies. See voice-controls-v2.tsx for the v2 layout equivalent
// and use-voice-controls.ts for the shared logic.
import { Show, type Accessor } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import type { DirectorySync } from "@/context/sync"
import { useVoiceControls } from "./use-voice-controls"

export function VoiceControls(props: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
  onTranscribed: (text: string) => void
}) {
  const voice = useVoiceControls(props)

  return (
    <div class="flex items-center gap-1">
      <Tooltip
        placement="top"
        value={
          voice.phase() === "recording" ? "Stop dictation" : voice.phase() === "transcribing" ? "Transcribing…" : "Dictate"
        }
      >
        <Button
          type="button"
          variant="ghost"
          class="size-8 p-0"
          classList={{ "animate-pulse": voice.phase() === "recording", "opacity-50": voice.phase() === "transcribing" }}
          disabled={voice.phase() === "transcribing"}
          onClick={voice.toggleMic}
          aria-pressed={voice.phase() === "recording"}
          aria-label="Dictate"
        >
          {/* Color via inline style directly on the icon svg, not a class: button.css
              sets [data-variant="ghost"] [data-slot="icon-svg"] { color: ... }, which
              beats a plain utility class on the icon but not an inline style. */}
          <Icon
            name="mic"
            class="size-4.5"
            style={voice.phase() === "recording" ? { color: "var(--icon-critical-base)" } : undefined}
          />
        </Button>
      </Tooltip>
      <Tooltip placement="top" value={voice.autoRead() ? "Auto-read replies: on" : "Auto-read replies: off"}>
        <Button
          type="button"
          variant="ghost"
          class="size-8 p-0"
          onClick={voice.toggleAutoRead}
          aria-pressed={voice.autoRead()}
          aria-label="Auto-read replies"
        >
          <Icon
            name={voice.autoRead() ? "speaker" : "speaker-off"}
            class="size-4.5"
            style={voice.autoRead() ? { color: "var(--icon-interactive-base)" } : undefined}
          />
        </Button>
      </Tooltip>
      <Show when={voice.error()}>
        <span class="text-12-regular text-icon-critical-base max-w-[160px] truncate" title={voice.error() ?? undefined}>
          {voice.error()}
        </span>
      </Show>
    </div>
  )
}
