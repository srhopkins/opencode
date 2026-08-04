// Composer voice controls for the v2 layout (default as of this fork —
// `newLayoutDesignsDefault = true` in @/context/settings). The shared
// PromptInputV2 component (@opencode-ai/session-ui) has no extension slot for
// extra toolbar buttons, so rather than fork that shared component this
// renders as a small row alongside it in prompt-input-v2.tsx. See
// voice-controls.tsx for the legacy v1 layout equivalent.
import { Show, type Accessor } from "solid-js"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import type { DirectorySync } from "@/context/sync"
import { useVoiceControls } from "./use-voice-controls"

export function VoiceControlsV2(props: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
  onTranscribed: (text: string) => void
}) {
  const voice = useVoiceControls(props)

  return (
    <div class="flex items-center gap-1 px-1">
      <TooltipV2
        placement="top"
        value={
          voice.phase() === "recording" ? "Stop dictation" : voice.phase() === "transcribing" ? "Transcribing…" : "Dictate"
        }
      >
        <IconButtonV2
          type="button"
          variant="ghost-muted"
          size="normal"
          disabled={voice.phase() === "transcribing"}
          onClick={voice.toggleMic}
          aria-pressed={voice.phase() === "recording"}
          aria-label="Dictate"
          // Color set via inline style, not a class: icon-button-v2.css pins
          // [data-slot="icon-svg"] { color: currentColor }, and its per-variant
          // color rules (e.g. ghost-muted) out-specificity a plain utility class
          // on the button, so only an inline style reliably overrides it here.
          style={voice.phase() === "recording" ? { color: "var(--v2-state-fg-danger)" } : undefined}
          classList={{ "animate-pulse": voice.phase() === "recording", "opacity-50": voice.phase() === "transcribing" }}
          icon={<IconV2 name="mic" />}
        />
      </TooltipV2>
      <TooltipV2 placement="top" value={voice.autoRead() ? "Auto-read replies: on" : "Auto-read replies: off"}>
        <IconButtonV2
          type="button"
          variant="ghost-muted"
          size="normal"
          onClick={voice.toggleAutoRead}
          aria-pressed={voice.autoRead()}
          aria-label="Auto-read replies"
          style={voice.autoRead() ? { color: "var(--v2-icon-icon-accent)" } : undefined}
          icon={<IconV2 name={voice.autoRead() ? "speaker" : "speaker-off"} />}
        />
      </TooltipV2>
      <Show when={voice.error()}>
        <span class="text-[12px] text-v2-state-fg-danger max-w-[160px] truncate" title={voice.error() ?? undefined}>
          {voice.error()}
        </span>
      </Show>
    </div>
  )
}
