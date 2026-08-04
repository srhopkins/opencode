import { describe, expect, test } from "bun:test"
import { homeNavAriaExpanded, homeNavToggleLabel, nextNavCollapsed } from "./home-nav-layout"

describe("nextNavCollapsed", () => {
  test("flips expanded to collapsed", () => {
    expect(nextNavCollapsed(false)).toBe(true)
  })

  test("flips collapsed back to expanded", () => {
    expect(nextNavCollapsed(true)).toBe(false)
  })

  test("is its own inverse (idempotent double toggle)", () => {
    const start = false
    expect(nextNavCollapsed(nextNavCollapsed(start))).toBe(start)
  })
})

describe("homeNavAriaExpanded", () => {
  test("reports expanded when not collapsed", () => {
    expect(homeNavAriaExpanded(false)).toBe(true)
  })

  test("reports not expanded when collapsed", () => {
    expect(homeNavAriaExpanded(true)).toBe(false)
  })
})

describe("homeNavToggleLabel", () => {
  const t = (key: string) => `translated:${key}`

  test("offers to expand when collapsed", () => {
    expect(homeNavToggleLabel(true, t)).toBe("translated:home.nav.expand")
  })

  test("offers to collapse when expanded", () => {
    expect(homeNavToggleLabel(false, t)).toBe("translated:home.nav.collapse")
  })
})
