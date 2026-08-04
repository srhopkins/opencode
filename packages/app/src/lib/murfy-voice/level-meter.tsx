// Presentational mic-level ring for icon buttons (~24px). Parent should be
// `relative`; this sits behind/around the icon via absolute positioning.
import type { Accessor } from "solid-js"

export function LevelMeter(props: {
  level: Accessor<number>
  active: Accessor<boolean>
}) {
  const style = () => {
    if (!props.active()) {
      return { transform: "scale(1)", opacity: "0" as const }
    }
    const level = Math.min(1, Math.max(0, props.level()))
    return {
      transform: `scale(${1 + level * 0.75})`,
      opacity: String(0.2 + level * 0.55),
    }
  }

  return (
    <span
      aria-hidden="true"
      class="pointer-events-none absolute inset-[-6px] rounded-full bg-v2-state-fg-danger/30 transition-[transform,opacity] duration-150 ease-out origin-center"
      style={style()}
    />
  )
}
