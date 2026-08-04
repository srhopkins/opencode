import { useDirectoryPicker } from "@/components/directory-picker"
import { useServerManagementController } from "@/components/dialog-select-server"
import { DialogNewProjectV2 } from "@/components/dialog-new-project-v2"
import { useSettingsCommand } from "@/components/settings-dialog"
import { DialogServerV2 } from "@/components/settings-v2/dialog-server-v2"
import { useGlobal } from "@/context/global"
import { type LocalProject } from "@/context/layout"
import { useLanguage } from "@/context/language"
import { useNotification } from "@/context/notification"
import { usePlatform } from "@/context/platform"
import { ServerConnection } from "@/context/server"
import { closeHomeProject, errorMessage, homeProjectDirectories } from "@/pages/layout/helpers"
import { murfyChatsPath } from "@/utils/murfy-rail-seed"
import { pathKey } from "@/utils/path-key"
import { Persist, persisted } from "@/utils/persist"
import { showToast } from "@/utils/toast"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import type { HomeController } from "./home-controller"

export function createHomeProjectsController(home: HomeController) {
  const platform = usePlatform()
  const pickDirectory = useDirectoryPicker()
  const dialog = useDialog()
  const language = useLanguage()
  const notification = useNotification()
  const openSettings = useSettingsCommand()
  const global = useGlobal()
  const serverManagement = useServerManagementController({ navigateOnAdd: false })
  // Sidebar v2 (murfy-0sn): ~/murfy/chats is a project like any other in the persisted store
  // (seeded append-only by murfy-rail-seed.ts), but the sidebar renders it as the flat "Chats"
  // section instead of an expandable folder row — this is how the view tells the two apart.
  const chatsPath = createMemo(() => murfyChatsPath(home.project.homedir(), import.meta.env.VITE_MURFY_ROOT))
  const isChats = (project: LocalProject) => pathKey(project.worktree) === pathKey(chatsPath())
  const [_state, setState, _, ready] = persisted(
    Persist.global("home.servers", ["home.servers.v1"]),
    createStore({ collapsed: {} as Record<string, boolean> }),
  )
  const [state] = createResource(
    () => ready.promise ?? Promise.resolve(),
    (promise) => promise.then(() => _state),
    { initialValue: _state },
  )
  function directories(project: LocalProject) {
    return [project.worktree, ...(project.sandboxes ?? [])]
  }

  function canRevealProject(conn: ServerConnection.Any) {
    return platform.platform === "desktop" && !!platform.openPath && ServerConnection.local(conn)
  }

  return {
    copy: {
      language,
    },
    selection: {
      value: home.selection.value,
    },
    server: {
      list: home.server.list,
      health: home.server.health,
      projects: home.project.forServer,
      collapsed: (conn: ServerConnection.Any) => state().collapsed[ServerConnection.key(conn)] ?? false,
      toggleCollapsed: (conn: ServerConnection.Any) => {
        const key = ServerConnection.key(conn)
        setState("collapsed", key, !state().collapsed[key])
      },
      canDefault: serverManagement.canDefault,
      defaultKey: serverManagement.defaultKey,
      setDefault: (conn: ServerConnection.Any | undefined) =>
        serverManagement.setDefault(conn ? ServerConnection.key(conn) : null),
      remove: (conn: ServerConnection.Any) => serverManagement.handleRemove(ServerConnection.key(conn)),
      edit: (conn: ServerConnection.Http) => dialog.show(() => <DialogServerV2 mode="edit" server={conn} />),
      focus: home.selection.focusServer,
    },
    project: {
      list: home.project.list,
      recentlyClosed: home.project.recentlyClosed,
      homedir: home.project.homedir,
      chatsPath,
      isChats,
      select: home.project.select,
      add: home.project.add,
      openNewSession: home.project.openProjectNewSession,
      toggleExpand: (conn: ServerConnection.Any, project: LocalProject) => {
        const ctx = global.ensureServerCtx(conn)
        if (project.expanded) ctx.projects.collapse(project.worktree)
        else ctx.projects.expand(project.worktree)
      },
      newChat: (conn: ServerConnection.Any) => home.project.openProjectNewSession(conn, chatsPath()),
      newProject: (conn: ServerConnection.Any) => {
        void dialog.show(() => (
          <DialogNewProjectV2 server={conn} onCreated={(worktree) => home.project.select(conn, worktree)} />
        ))
      },
      edit: (conn: ServerConnection.Any, project: LocalProject) => {
        void import("@/components/dialog-edit-project-v2").then(({ DialogEditProjectV2 }) => {
          void dialog.show(() => <DialogEditProjectV2 server={conn} project={project} />)
        })
      },
      unseenCount: (conn: ServerConnection.Any, project: LocalProject) => {
        const state = notification.ensureServerState(ServerConnection.key(conn))
        return directories(project).reduce((total, directory) => total + state.project.unseenCount(directory), 0)
      },
      clearNotifications: (conn: ServerConnection.Any, project: LocalProject) => {
        const state = notification.ensureServerState(ServerConnection.key(conn))
        directories(project)
          .filter((directory) => state.project.unseenCount(directory) > 0)
          .forEach((directory) => state.project.markViewed(directory))
      },
      choose: (conn: ServerConnection.Any) => {
        if (home.server.health(conn)?.healthy === false) return
        pickDirectory({
          server: conn,
          title: language.t("command.project.open"),
          multiple: true,
          onSelect: (result) => home.project.add(conn, homeProjectDirectories(result)),
        })
      },
      close: (conn: ServerConnection.Any, directory: string) => {
        const next = closeHomeProject(
          home.selection.value(),
          ServerConnection.key(conn),
          home.server.context(conn).projects,
          directory,
        )
        if (next) home.selection.set(next)
      },
      move: (conn: ServerConnection.Any, worktree: string, index: number) => {
        // The rendered "Projects" list excludes the pinned Chats tile, so `index` is an index
        // into that subset — exclude Chats here too, matching the legacy rail (context/layout.tsx).
        const key = pathKey(chatsPath())
        home.server.context(conn).projects.move(worktree, index, (item) => pathKey(item) === key)
      },
      canReveal: canRevealProject,
      reveal: (conn: ServerConnection.Any, project: LocalProject) => {
        if (!platform.openPath || !canRevealProject(conn)) return
        platform.openPath(project.worktree).catch((cause: unknown) =>
          showToast({
            title: language.t("common.requestFailed"),
            description: errorMessage(cause, language.t("common.requestFailed")),
          }),
        )
      },
    },
    utility: {
      settings: openSettings,
      help: () => platform.openExternal("https://opencode.ai/desktop-feedback"),
    },
  }
}

export type HomeProjectsController = ReturnType<typeof createHomeProjectsController>
