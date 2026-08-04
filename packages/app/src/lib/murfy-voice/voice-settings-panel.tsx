// Gear popover body: default talk mode, sentence/comma gap + comma-split
// tuning, a collapsed/advanced VAD sensitivity section, and the PTT key
// rebind (moved here from its own standalone popover trigger). Shared content
// rendered inside both composer layouts' own <Popover> wrapper — see
// voice-controls.tsx / voice-controls-v2.tsx. Reads/writes settings.ts's
// factories directly rather than taking them as props: those factories are
// singleton-cached per key (see settings.ts), so this panel automatically
// shares live state with auto-read.ts's SpeechQueue and useVoiceLoop's
// getConfig without any extra prop plumbing.
import { createSignal, Show, type Accessor, type Setter } from "solid-js"
import type { KeyBinding } from "./keybinding"
import { describeKeyBinding } from "./keybinding"
import {
  createCommaGapMsSetting,
  createCommaSplitMinWordsSetting,
  createSentenceGapMsSetting,
  createVadMinSpeechMsSetting,
  createVadStartFloorMinSetting,
  createVadStartMsSetting,
  createVadStopMsSetting,
  createVoiceModeSetting,
  type VoiceMode,
} from "./settings"

function SliderRow(props: {
  label: string
  value: Accessor<number>
  min: number
  max: number
  step: number
  unit?: string
  testId?: string
  onInput: (value: number) => void
}) {
  return (
    <label class="flex flex-col gap-1">
      <span class="flex items-center justify-between text-12-regular text-text-weak">
        <span>{props.label}</span>
        <span class="text-text-base tabular-nums">
          {props.value()}
          {props.unit ?? ""}
        </span>
      </span>
      <input
        type="range"
        data-testid={props.testId}
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value()}
        onInput={(e) => props.onInput(Number(e.currentTarget.value))}
        class="w-full accent-icon-interactive-base"
      />
    </label>
  )
}

export function VoiceSettingsPanel(props: {
  pttKeyBinding: Accessor<KeyBinding>
  pttCapturing: Accessor<boolean>
  setPttCapturing: Setter<boolean>
}) {
  const [defaultMode, setDefaultMode] = createVoiceModeSetting()
  const [sentenceGapMs, setSentenceGapMs] = createSentenceGapMsSetting()
  const [commaGapMs, setCommaGapMs] = createCommaGapMsSetting()
  const [commaSplitMinWords, setCommaSplitMinWords] = createCommaSplitMinWordsSetting()
  const [startMs, setStartMs] = createVadStartMsSetting()
  const [stopMs, setStopMs] = createVadStopMsSetting()
  const [minSpeechMs, setMinSpeechMs] = createVadMinSpeechMsSetting()
  const [startFloorMin, setStartFloorMin] = createVadStartFloorMinSetting()
  const [advancedOpen, setAdvancedOpen] = createSignal(false)

  return (
    <div class="flex flex-col gap-3 p-3 w-[280px] text-12-regular">
      <label class="flex flex-col gap-1">
        <span class="text-text-weak">Default talk mode</span>
        <select
          data-testid="voice-default-mode-select"
          class="h-7 rounded-md border border-border-weak-base bg-transparent px-1.5 text-12-regular text-text-base outline-none"
          value={defaultMode()}
          onChange={(e) => setDefaultMode(e.currentTarget.value as VoiceMode)}
        >
          <option value="ptt">Push-to-talk</option>
          <option value="vad">Voice loop (VAD)</option>
        </select>
      </label>

      <SliderRow
        label="Sentence gap"
        value={sentenceGapMs}
        min={0}
        max={1200}
        step={10}
        unit="ms"
        testId="voice-sentence-gap-slider"
        onInput={setSentenceGapMs}
      />

      <SliderRow
        label="Comma gap (0 = off)"
        value={commaGapMs}
        min={0}
        max={800}
        step={10}
        unit="ms"
        testId="voice-comma-gap-slider"
        onInput={setCommaGapMs}
      />

      <label class="flex flex-col gap-1">
        <span class="text-text-weak">Comma split min words</span>
        <input
          type="number"
          data-testid="voice-comma-min-words-input"
          min={0}
          step={1}
          value={commaSplitMinWords()}
          onInput={(e) => {
            const next = Number(e.currentTarget.value)
            if (Number.isFinite(next)) setCommaSplitMinWords(Math.max(0, Math.round(next)))
          }}
          class="h-7 rounded-md border border-border-weak-base bg-transparent px-1.5 text-12-regular text-text-base outline-none"
        />
      </label>

      <button
        type="button"
        data-testid="voice-vad-advanced-toggle"
        class="self-start text-12-regular text-icon-interactive-base hover:underline"
        onClick={() => setAdvancedOpen((open) => !open)}
      >
        {advancedOpen() ? "Hide" : "Show"} VAD sensitivity (advanced)
      </button>

      <Show when={advancedOpen()}>
        <div class="flex flex-col gap-3 pl-2 border-l border-border-weak-base">
          <SliderRow
            label="Start debounce"
            value={startMs}
            min={40}
            max={600}
            step={10}
            unit="ms"
            testId="voice-vad-start-ms-slider"
            onInput={setStartMs}
          />
          <SliderRow
            label="Stop debounce"
            value={stopMs}
            min={200}
            max={2000}
            step={50}
            unit="ms"
            testId="voice-vad-stop-ms-slider"
            onInput={setStopMs}
          />
          <SliderRow
            label="Min speech length"
            value={minSpeechMs}
            min={0}
            max={1000}
            step={10}
            unit="ms"
            testId="voice-vad-min-speech-ms-slider"
            onInput={setMinSpeechMs}
          />
          <SliderRow
            label="Sensitivity floor"
            value={startFloorMin}
            min={0.001}
            max={0.1}
            step={0.001}
            testId="voice-vad-start-floor-min-slider"
            onInput={setStartFloorMin}
          />
        </div>
      </Show>

      <div class="flex flex-col gap-1 pt-2 border-t border-border-weak-base">
        <span class="text-text-weak">Push-to-talk key</span>
        <Show
          when={props.pttCapturing()}
          fallback={
            <button
              type="button"
              data-testid="voice-ptt-key-rebind-button"
              class="self-start rounded-md border border-border-weak-base px-2 py-1 text-12-regular text-text-base hover:bg-surface-base-hover"
              onClick={() => props.setPttCapturing(true)}
            >
              {describeKeyBinding(props.pttKeyBinding())}
            </button>
          }
        >
          <span class="text-text-weak">Press any key to bind push-to-talk…</span>
        </Show>
      </div>
    </div>
  )
}
