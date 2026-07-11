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

  it("keeps the board card constrained to the chessboard width", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/GamePage.css"), "utf8")

    expect(css).toContain("--game-board-card-max-width: calc(38rem + 2.7rem);")
    expect(css).toContain("grid-template-columns: fit-content(var(--game-board-card-max-width)) minmax(16rem, 1fr);")
    expect(css).toContain("width: min(100%, var(--game-board-card-max-width));")
    expect(css).toContain("min-width: 0;")
    expect(css).toContain("@media (max-width: 900px)")
    expect(css).toContain("justify-self: stretch;")
  })
})
