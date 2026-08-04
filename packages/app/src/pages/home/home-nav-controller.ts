import { createStore } from "solid-js/store"
import { Persist, persisted } from "@/utils/persist"
import { nextNavCollapsed } from "./home-nav-layout"

// MVP layout (murfy-7ur): whole-nav collapse for the new layout's left rail
// (Sidebar v2 content lives in home-projects-view.tsx and is untouched by this
// controller — it only tracks whether the rail is shown or hidden). Deliberately
// a dedicated key rather than reusing the legacy `layout.sidebar` primitive:
// that one defaults to `opened: false` meaning "narrow icon rail" in the legacy
// shell, which would make a fresh install's new-layout nav start hidden — the
// wrong default here, where collapsed must mean "fully hidden, ChatGPT-style."
export function createHomeNavController() {
  const [state, setState] = persisted(
    Persist.global("home.layout", ["home.layout.v1"]),
    createStore({ navCollapsed: false }),
  )

  return {
    collapsed: () => state.navCollapsed,
    toggle: () => setState("navCollapsed", nextNavCollapsed),
    set: (value: boolean) => setState("navCollapsed", value),
  }
}

export type HomeNavController = ReturnType<typeof createHomeNavController>
