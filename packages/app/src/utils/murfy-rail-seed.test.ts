import { describe, expect, test } from "bun:test"
import { murfyChatsPath, resolveMurfyRoot, seedMurfyRail } from "./murfy-rail-seed"

describe("resolveMurfyRoot", () => {
  test("defaults to ~/murfy", () => {
    expect(resolveMurfyRoot("/Users/steve")).toBe("/Users/steve/murfy")
  })

  test("honors an override root name", () => {
    expect(resolveMurfyRoot("/Users/steve", "murfy-dev")).toBe("/Users/steve/murfy-dev")
  })

  test("ignores a blank override", () => {
    expect(resolveMurfyRoot("/Users/steve", "  ")).toBe("/Users/steve/murfy")
  })
})

describe("murfyChatsPath", () => {
  test("appends /chats to the resolved root", () => {
    expect(murfyChatsPath("/Users/steve")).toBe("/Users/steve/murfy/chats")
  })
})

describe("seedMurfyRail", () => {
  test("ensures chats plus every project directory", async () => {
    const ensured: string[] = []
    await seedMurfyRail({
      home: "/Users/steve",
      list: async (directory) => {
        expect(directory).toBe("/Users/steve/murfy/projects")
        return [
          { name: "murfy", type: "directory" },
          { name: "sandbox", type: "directory" },
          { name: "README.md", type: "file" },
        ]
      },
      ensure: (directory) => ensured.push(directory),
    })

    expect(ensured).toEqual([
      "/Users/steve/murfy/chats",
      "/Users/steve/murfy/projects/murfy",
      "/Users/steve/murfy/projects/sandbox",
    ])
  })

  test("skips hidden directories", async () => {
    const ensured: string[] = []
    await seedMurfyRail({
      home: "/Users/steve",
      list: async () => [
        { name: ".git", type: "directory" },
        { name: "visible", type: "directory" },
      ],
      ensure: (directory) => ensured.push(directory),
    })

    expect(ensured).toEqual(["/Users/steve/murfy/chats", "/Users/steve/murfy/projects/visible"])
  })

  test("still ensures chats when the projects listing fails", async () => {
    const ensured: string[] = []
    await seedMurfyRail({
      home: "/Users/steve",
      list: async () => {
        throw new Error("boom")
      },
      ensure: (directory) => ensured.push(directory),
    })

    expect(ensured).toEqual(["/Users/steve/murfy/chats"])
  })

  test("is a no-op without a home directory", async () => {
    const ensured: string[] = []
    await seedMurfyRail({
      home: "",
      list: async () => [],
      ensure: (directory) => ensured.push(directory),
    })

    expect(ensured).toEqual([])
  })

  test("respects a custom root override", async () => {
    const ensured: string[] = []
    await seedMurfyRail({
      home: "/Users/steve",
      root: "murfy-dev",
      list: async (directory) => {
        expect(directory).toBe("/Users/steve/murfy-dev/projects")
        return []
      },
      ensure: (directory) => ensured.push(directory),
    })

    expect(ensured).toEqual(["/Users/steve/murfy-dev/chats"])
  })
})
