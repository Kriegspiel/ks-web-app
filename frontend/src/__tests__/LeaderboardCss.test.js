import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../pages/Leaderboard.css"), "utf8")

describe("Leaderboard page-size dropdown", () => {
  it("insets the arrow and reserves room without intercepting select clicks", () => {
    expect(css).toMatch(/\.leaderboard-page-size-input\s*\{[^}]*position:\s*relative;/)
    expect(css).toMatch(/\.leaderboard-page-size-input::after\s*\{[^}]*right:\s*0\.85rem;[^}]*pointer-events:\s*none;/)
    expect(css).toMatch(/\.leaderboard-page-size-control select\s*\{[^}]*appearance:\s*none;[^}]*padding:\s*0\.48rem 2\.3rem 0\.48rem 0\.72rem;/)
  })
})

describe("Leaderboard table corners", () => {
  it("rounds both outer header backgrounds inside the table border", () => {
    expect(css).toMatch(/\.leaderboard-table--interactive thead th:first-child\s*\{\s*border-top-left-radius:\s*calc\(var\(--radius\) - 1px\);\s*\}/)
    expect(css).toMatch(/\.leaderboard-table--interactive thead th:last-child\s*\{\s*border-top-right-radius:\s*calc\(var\(--radius\) - 1px\);\s*\}/)
  })

  it("uses only the rounded table border below the final row, including a colspan empty row", () => {
    expect(css).toMatch(/\.leaderboard-table--interactive tbody tr:last-child td\s*\{\s*border-bottom:\s*0;\s*\}/)
    expect(css).toMatch(/\.leaderboard-table th,\s*\.leaderboard-table td\s*\{[^}]*border-bottom:\s*1px solid var\(--border\);/)
  })

  it("keeps the header sticky without clipping the interactive table", () => {
    expect(css).toMatch(/\.leaderboard-table--interactive thead th\s*\{\s*position:\s*sticky;/)
    expect(css).toMatch(/\.leaderboard-table--interactive\s*\{[^}]*overflow:\s*visible;/)
  })
})
