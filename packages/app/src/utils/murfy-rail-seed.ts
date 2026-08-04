const DEFAULT_MURFY_ROOT_NAME = "murfy"

function joinPath(...parts: string[]) {
  return parts
    .map((part, index) => (index === 0 ? part.replace(/\/+$/, "") : part.replace(/^\/+|\/+$/g, "")))
    .filter(Boolean)
    .join("/")
}

export function resolveMurfyRoot(home: string, override?: string) {
  const name = override?.trim() || DEFAULT_MURFY_ROOT_NAME
  return joinPath(home, name)
}

export function murfyChatsPath(home: string, override?: string) {
  return joinPath(resolveMurfyRoot(home, override), "chats")
}

export type MurfyRailSeedEntry = { name: string; type: string }

// Discovers ~/murfy/chats + ~/murfy/projects/* and hands each off to `ensure`, which is expected
// to be append-only (see server.tsx's `ensure`): it must never clobber a tile the user already
// closed, reordered, or removed. Deleted directories are intentionally left alone (no pruning) —
// the rail only ever grows from this pass.
export async function seedMurfyRail(input: {
  home: string
  root?: string
  list: (directory: string) => Promise<MurfyRailSeedEntry[]>
  ensure: (directory: string) => void
}) {
  if (!input.home) return
  const root = resolveMurfyRoot(input.home, input.root)
  input.ensure(joinPath(root, "chats"))
  const entries = await input.list(joinPath(root, "projects")).catch(() => [] as MurfyRailSeedEntry[])
  for (const entry of entries) {
    if (entry.type !== "directory") continue
    if (entry.name.startsWith(".")) continue
    input.ensure(joinPath(root, "projects", entry.name))
  }
}
