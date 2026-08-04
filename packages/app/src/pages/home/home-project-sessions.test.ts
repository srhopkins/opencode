import { describe, expect, test } from "bun:test"
import type { Session } from "@opencode-ai/sdk/v2/client"
import type { LocalProject } from "@/context/layout"
import { sessionsForProject } from "./home-project-sessions"
import type { HomeSessionRecord } from "./home-sessions-controller"

function project(worktree: string, sandboxes?: string[]): LocalProject {
  return { worktree, expanded: true, sandboxes }
}

function session(id: string, directory: string): Session {
  return {
    id,
    slug: id,
    projectID: "",
    workspaceID: "",
    directory,
    path: "",
    version: "",
    time: { created: 0, updated: 0 },
  } as Session
}

function record(id: string, directory: string, forProject: LocalProject): HomeSessionRecord {
  return { session: session(id, directory), project: forProject, projectName: forProject.worktree }
}

describe("sessionsForProject", () => {
  test("keeps only records whose resolved project matches the worktree", () => {
    const alpha = project("/home/steve/murfy/projects/alpha")
    const beta = project("/home/steve/murfy/projects/beta")
    const records = [
      record("1", "/home/steve/murfy/projects/alpha", alpha),
      record("2", "/home/steve/murfy/projects/beta", beta),
      record("3", "/home/steve/murfy/projects/alpha", alpha),
    ]

    expect(sessionsForProject(records, alpha).map((r) => r.session.id)).toEqual(["1", "3"])
    expect(sessionsForProject(records, beta).map((r) => r.session.id)).toEqual(["2"])
  })

  test("matches sandbox directories against the parent project", () => {
    const parent = project("/home/steve/murfy/projects/alpha", ["/tmp/alpha-sandbox"])
    const records = [record("1", "/tmp/alpha-sandbox", parent)]

    expect(sessionsForProject(records, parent).map((r) => r.session.id)).toEqual(["1"])
  })

  test("returns an empty list when nothing matches", () => {
    const alpha = project("/home/steve/murfy/projects/alpha")
    const beta = project("/home/steve/murfy/projects/beta")
    const records = [record("1", "/home/steve/murfy/projects/beta", beta)]

    expect(sessionsForProject(records, alpha)).toEqual([])
  })

  test("preserves the incoming (recency) order", () => {
    const alpha = project("/home/steve/murfy/projects/alpha")
    const records = [record("newest", "/home/steve/murfy/projects/alpha", alpha), record("oldest", "/home/steve/murfy/projects/alpha", alpha)]

    expect(sessionsForProject(records, alpha).map((r) => r.session.id)).toEqual(["newest", "oldest"])
  })
})
