// Composer toolbar controls for murfy voice (legacy v1 layout): dictation
// mic, the unified PTT/VAD talk button with a live level ring, the PTT|VAD
// mode toggle, the TTS speed dropdown, the gear settings popover, and the
// auto-read toggle. See voice-controls-v2.tsx for the v2 layout equivalent
// and use-voice-controls.ts for the shared logic.
import { createSignal, Show, type Accessor } from "solid-js"
import { Button } from "@opencode-ai/ui/button"
import { Icon } from "@opencode-ai/ui/icon"
import { Tooltip } from "@opencode-ai/ui/tooltip"
import { Popover } from "@opencode-ai/ui/popover"
import type { DirectorySync } from "@/context/sync"
import { useVoiceControls } from "./use-voice-controls"
import { LevelMeter } from "./level-meter"
import { VoiceModeToggle } from "./voice-mode-toggle"
import { VoiceSpeedSelect } from "./voice-speed-select"
import { VoiceSettingsPanel } from "./voice-settings-panel"
import { createTtsSpeedSetting } from "./settings"

export function VoiceControls(props: {
  sessionID: Accessor<string | undefined>
  sync: Accessor<DirectorySync>
  onTranscribed: (text: string) => void
  onAutoSend: (text: string) => void
}) {
  const voice = useVoiceControls(props)
  const [ttsSpeed, setTtsSpeed] = createTtsSpeedSetting()
  const [settingsOpen, setSettingsOpen] = createSignal(false)

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
              sets [data-slot="icon-svg"] { color: ... }, which
              beats a plain utility class on the icon but not an inline style. */}
          <Icon
            name="mic"
            class="size-4.5"
            style={voice.phase() === "recording" ? { color: "var(--icon-critical-base)" } : undefined}
          />
        </Button>
      </Tooltip>

      <Tooltip placement="top" value={voice.talk.label()}>
        <div class="relative">
          <LevelMeter level={voice.talk.level} active={voice.talk.micOpen} />
          <Button
            type="button"
            variant="ghost"
            class="relative size-8 p-0"
            classList={{
              "animate-pulse": voice.talk.danger() || voice.talk.speaking(),
              "opacity-50": voice.talk.busy(),
            }}
            disabled={voice.mode() === "ptt" && voice.talk.busy()}
            onClick={voice.talk.press}
            aria-pressed={voice.talk.micOpen()}
            aria-label="Talk"
            data-testid="voice-talk-button"
          >
            <Icon
              name={voice.talk.icon()}
              class="size-4.5"
              style={
                voice.talk.danger()
                  ? { color: "var(--icon-critical-base)" }
                  : voice.talk.speaking()
                    ? { color: "var(--icon-interactive-base)" }
                    : undefined
              }
            />
          </Button>
        </div>
      </Tooltip>

      <VoiceModeToggle mode={voice.mode} onChange={voice.setMode} />

      <VoiceSpeedSelect speed={ttsSpeed} onChange={setTtsSpeed} />

      <Popover
        open={settingsOpen()}
        onOpenChange={setSettingsOpen}
        trigger={<Icon name="settings-gear" class="size-4" />}
        triggerAs="button"
        triggerProps={{
          type: "button",
          "aria-label": "Voice settings",
          class: "size-8 p-0 flex items-center justify-center rounded text-icon-weak-base hover:text-icon-base",
        }}
      >
        <VoiceSettingsPanel
          pttKeyBinding={voice.ptt.keyBinding}
          pttCapturing={voice.ptt.capturing}
          setPttCapturing={voice.ptt.setCapturing}
        />
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
      <Show when={voice.error() || voice.talk.error()}>
        <span
          class="text-12-regular text-icon-critical-base max-w-[160px] truncate"
          title={voice.error() ?? voice.talk.error() ?? undefined}
        >
          {voice.error() ?? voice.talk.error()}
        </span>
      </Show>
    </div>
  )
}
