import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("GamePage CSS", () => {
  it("keeps the signed-in line evenly spaced between the title and board area", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/GamePage.css"), "utf8")

    expect(css).toContain("--game-page-header-spacing: 0.85rem;")
    expect(css).toContain("gap: var(--game-page-header-spacing);")
    expect(css).toContain("margin-bottom: var(--game-page-header-spacing);")
    expect(css).toContain(".game-page__title-block h1")
    expect(css).toContain("margin: 0;")
  })

  it("keeps the board card balanced with the referee panel", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/GamePage.css"), "utf8")

    expect(css).toContain("--game-board-card-max-width: calc(38rem + 2.7rem);")
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);")
    expect(css).toContain("max-width: var(--game-board-card-max-width);")
    expect(css).toContain("min-width: 0;")
    expect(css).toContain("@media (max-width: 900px)")
    expect(css).toContain("justify-self: stretch;")
  })

  it("allows the current referee message timeline to wrap without forcing panel width", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/GamePage.css"), "utf8")

    expect(css).toContain(".game-referee-latest__value--timeline")
    expect(css).toContain("flex-wrap: wrap;")
    expect(css).toContain("flex: 1 1 11rem;")
    expect(css).toContain("min-width: min(100%, 9.75rem);")
    expect(css).toContain("overflow-wrap: anywhere;")
  })
})
