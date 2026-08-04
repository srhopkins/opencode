import { ScrollView } from "@opencode-ai/ui/scroll-view"
import { Icon as IconV2 } from "@opencode-ai/ui/v2/icon"
import { IconButtonV2 } from "@opencode-ai/ui/v2/icon-button-v2"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { createHomeController } from "./home/home-controller"
import { createHomeNavController } from "./home/home-nav-controller"
import { createHomeProjectsController } from "./home/home-projects-controller"
import { HomeUtilityNav } from "./home/home-projects-view"
import { HomeProjects } from "./home/home-projects"
import { createHomeScrollController } from "./home/home-scroll-controller"
import { createHomeSessionSearchController } from "./home/home-session-search-controller"
import { createHomeSessionsController } from "./home/home-sessions-controller"
import { HomeSessions } from "./home/home-sessions"
import { homeNavAriaExpanded, homeNavToggleLabel } from "./home/home-nav-layout"

// MVP layout (murfy-7ur): full-bleed shell. The nav (Sidebar v2 content, unchanged)
// is a flush rail pinned to the true left edge of the viewport — no card chrome, no
// centering — while the session list keeps the app's usual raised-card treatment and
// fills whatever width remains. Below `lg` the rail just becomes the top block of a
// single stacked column (today's mobile behavior), so collapsing is a desktop-only
// affordance and doesn't touch mobile layout.
export function NewHome() {
  const home = createHomeController()
  const projects = createHomeProjectsController(home)
  const sessions = createHomeSessionsController(home)
  const search = createHomeSessionSearchController(home, sessions)
  const scroll = createHomeScrollController(sessions.data.groups)
  const nav = createHomeNavController()
  const language = projects.copy.language

  return (
    <div class="relative flex h-full min-h-0 w-full flex-1 flex-col self-stretch overflow-hidden lg:flex-row">
      <div
        class="min-h-0 shrink-0 overflow-hidden lg:h-full lg:transition-[width] lg:duration-150 lg:ease-out"
        classList={{ "lg:w-[280px]": !nav.collapsed(), "lg:w-0": nav.collapsed() }}
      >
        <div class="h-full w-full px-3 lg:h-full lg:w-[280px] lg:[container-type:size]">
          <HomeProjects projects={projects} sessions={sessions} scroll={scroll} />
        </div>
      </div>

      <div class="absolute left-2 top-3 z-40 hidden lg:block">
        <TooltipV2 placement="bottom" value={homeNavToggleLabel(nav.collapsed(), language.t)}>
          <IconButtonV2
            type="button"
            variant="ghost-muted"
            size="large"
            data-action="home-nav-toggle"
            state={homeNavAriaExpanded(nav.collapsed()) ? "pressed" : undefined}
            onClick={nav.toggle}
            aria-label={homeNavToggleLabel(nav.collapsed(), language.t)}
            aria-expanded={homeNavAriaExpanded(nav.collapsed())}
            icon={<IconV2 name="sidebar-right" />}
          />
        </TooltipV2>
      </div>

      <div class="m-2 min-h-0 min-w-0 flex-1 overflow-hidden rounded-[10px] bg-v2-background-bg-base shadow-[var(--v2-elevation-raised)]">
        <ScrollView
          class="h-full [container-type:size]"
          thumbContainer={scroll.viewport.thumbTrack}
          thumbHoverTarget={scroll.viewport.hoverTarget}
          viewportRef={scroll.viewport.setViewport}
          onScroll={(event) => scroll.viewport.update(event.currentTarget.scrollTop)}
          onWheel={scroll.viewport.containOuterWheel}
        >
          <div class="mx-auto flex min-h-full w-full max-w-[880px] flex-col gap-4 px-3 lg:gap-8 lg:px-8">
            <HomeSessions sessions={sessions} search={search} scroll={scroll} />
            <HomeUtilityNav
              class="flex lg:hidden"
              onOpenSettings={projects.utility.settings}
              onOpenHelp={projects.utility.help}
              language={projects.copy.language}
            />
          </div>
        </ScrollView>
      </div>
    </div>
  )
}
