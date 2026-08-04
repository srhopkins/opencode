// PTT|VAD segmented toggle, rendered directly on the composer bar next to the
// talk button (Steve's explicit ask: the mode switch is a first-class bar
// control, not buried in a settings popover). Shared between both composer
// layouts — SegmentedControlV2 reads `--v2-*` CSS variables defined globally
// on `:root` (packages/ui/src/v2/styles/theme.css), so it renders correctly
// even inside the legacy v1 layout.
import { SegmentedControlV2, SegmentedControlItemV2 } from "@opencode-ai/ui/v2/segmented-control-v2"
import type { Accessor } from "solid-js"
import type { VoiceMode } from "./settings"

export function VoiceModeToggle(props: { mode: Accessor<VoiceMode>; onChange: (mode: VoiceMode) => void }) {
  return (
    <SegmentedControlV2
      value={props.mode()}
      onChange={(value) => {
        if (value === "ptt" || value === "vad") props.onChange(value)
      }}
      aria-label="Talk mode"
      style={{ width: "108px", height: "28px" }}
    >
      <SegmentedControlItemV2 value="ptt" aria-label="Push-to-talk mode">
        PTT
      </SegmentedControlItemV2>
      <SegmentedControlItemV2 value="vad" aria-label="Voice-loop (VAD) mode">
        VAD
      </SegmentedControlItemV2>
    </SegmentedControlV2>
  )
}
