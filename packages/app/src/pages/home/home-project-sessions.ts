import { pathKey } from "@/utils/path-key"
import type { HomeSessionRecord } from "./home-sessions-controller"

// Sidebar v2 (murfy-0sn): filters the already-loaded, unscoped session index down to one
// project's sessions for the nested "Projects" tree — most recent first (records arrive
// pre-sorted by recency from buildHomeSessionRecords), capped with a "show more" affordance.
// Deliberately reuses the existing records rather than issuing a new per-project fetch.
export function sessionsForProject(
  records: HomeSessionRecord[],
  project: { worktree: string; sandboxes?: string[] },
): HomeSessionRecord[] {
  const keys = new Set([project.worktree, ...(project.sandboxes ?? [])].map(pathKey))
  return records.filter((record) => keys.has(pathKey(record.project.worktree)))
}

export const HOME_PROJECT_NESTED_SESSION_CAP = 5
