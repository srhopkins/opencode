// Composer toolbar controls for murfy voice phase A (legacy v1 layout): a mic
// button for dictation-to-draft and a speaker toggle for auto-reading
// completed replies. See voice-controls-v2.tsx for the v2 layout equivalent
// and use-voice-controls.ts for the shared logic.
import { Show, type Accessor } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Popover } from "@opencode-ai/ui/popover"
import type { DirectorySync } from "@/context/sync"
import { useVoiceControls } from "./use-voice-controls"

export function VoiceControls(props: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
  onTranscribed: (text: string) => void
  onAutoSend: (text: string) => void
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
      <Tooltip
        placement="top"
        value={
          voice.ptt.phase() === "recording"
            ? "Push-to-talk: press again to send"
            : voice.ptt.phase() === "transcribing"
              ? "Sending…"
              : `Push-to-talk (${voice.ptt.describeKeyBinding()})`
        }
      >
        <Button
          type="button"
          variant="ghost"
          class="size-8 p-0"
          classList={{
            "animate-pulse": voice.ptt.phase() === "recording",
            "opacity-50": voice.ptt.phase() === "transcribing",
          }}
          disabled={voice.ptt.phase() === "transcribing"}
          onClick={voice.ptt.togglePtt}
          aria-pressed={voice.ptt.phase() === "recording"}
          aria-label="Push-to-talk"
        >
          <Icon
            name="headset"
            class="size-4.5"
            style={voice.ptt.phase() === "recording" ? { color: "var(--icon-critical-base)" } : undefined}
          />
        </Button>
      </Tooltip>
      <Popover
        open={voice.ptt.capturing()}
        onOpenChange={(open) => voice.ptt.setCapturing(open)}
        trigger={<Icon name="keyboard" class="size-4" />}
        triggerAs="button"
        triggerProps={{
          type: "button",
          "aria-label": "Set push-to-talk key",
          class: "size-8 p-0 flex items-center justify-center rounded text-icon-weak-base hover:text-icon-base",
        }}
      >
        <div class="p-3 text-12-regular leading-snug max-w-[220px]">
          <Show
            when={voice.ptt.capturing()}
            fallback={
              <>
                Push-to-talk key: <strong>{voice.ptt.describeKeyBinding()}</strong>
              </>
            }
          >
            Press any key to bind push-to-talk…
          </Show>
        </div>
      </Popover>
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
      <Show when={voice.error() || voice.ptt.error()}>
        <span class="text-12-regular text-icon-critical-base max-w-[160px] truncate" title={voice.error() ?? voice.ptt.error() ?? undefined}>
          {voice.error() ?? voice.ptt.error()}
        </span>
      </Show>
    </div>
  )
}
