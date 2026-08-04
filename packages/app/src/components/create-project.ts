import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useMutation } from "@tanstack/solid-query"
import { createStore } from "solid-js/store"
import { useGlobal } from "@/context/global"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { ServerConnection } from "@/context/server"
import { errorMessage } from "@/pages/layout/helpers"
import { createMurfyDirectory } from "@/utils/murfy-mkdir"
import { resolveMurfyRoot } from "@/utils/murfy-rail-seed"
import { showToast } from "@/utils/toast"

// murfy: fork addition (murfy-0sn) — "New Project" button in the Sidebar v2 Projects header.
// Sanitizes the entered name into a directory name, mkdir -p's ~/murfy/projects/<name> via the
// fork-only /murfy/mkdir route (utils/murfy-mkdir.ts), then ensure()s it into the tile list the
// same way the rail auto-seed does, so a brand-new project behaves identically to a discovered one.
export function sanitizeProjectName(name: string) {
  return name
    .trim()
    .replace(/^[./\\]+/, "")
    .replace(/[\\/]+/g, "-")
}

export function createNewProjectModel(props: { server: ServerConnection.Any; onCreated: (worktree: string) => void }) {
  const dialog = useDialog()
  const global = useGlobal()
  const platform = usePlatform()
  const language = useLanguage()
  const [store, setStore] = createStore({ name: "" })

  const save = useMutation(() => ({
    mutationFn: async () => {
      const name = sanitizeProjectName(store.name)
      if (!name) return

      const ctx = global.ensureServerCtx(props.server)
      const home = ctx.sync.data.path.home
      if (!home) {
        showToast({ title: language.t("common.requestFailed") })
        return
      }

      const root = resolveMurfyRoot(home, import.meta.env.VITE_MURFY_ROOT)
      const target = `${root}/projects/${name}`
      const result = await createMurfyDirectory(props.server.http, target, platform.fetch)
      if (!result.ok) {
        showToast({
          title: language.t("home.project.new.error"),
          description: errorMessage(new Error(result.error), language.t("common.requestFailed")),
        })
        return
      }

      void ctx.sync.project.loadSessions(target)
      ctx.projects.ensure(target)
      props.onCreated(target)
      dialog.close()
    },
  }))

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (save.isPending) return
    if (!sanitizeProjectName(store.name)) return
    save.mutate()
  }

  return {
    store,
    setStore,
    save,
    submit,
    close() {
      dialog.close()
    },
  }
}
