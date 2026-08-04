import { describe, expect, test } from "bun:test"
import { sanitizeProjectName } from "./create-project"

describe("sanitizeProjectName", () => {
  test("trims surrounding whitespace", () => {
    expect(sanitizeProjectName("  my project  ")).toBe("my project")
  })

  test("replaces path separators so the name can't escape the projects directory", () => {
    expect(sanitizeProjectName("a/b\\c")).toBe("a-b-c")
  })

  test("strips leading dots to avoid hidden or relative-path directories", () => {
    expect(sanitizeProjectName("../secret")).toBe("secret")
    expect(sanitizeProjectName(".hidden")).toBe("hidden")
  })

  test("returns an empty string for blank input", () => {
    expect(sanitizeProjectName("   ")).toBe("")
    expect(sanitizeProjectName("")).toBe("")
  })

  test("leaves an ordinary name untouched", () => {
    expect(sanitizeProjectName("moto-guzzi-v85")).toBe("moto-guzzi-v85")
  })
})
