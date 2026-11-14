import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const readCss = (path) => readFileSync(resolve(process.cwd(), "src", path), "utf8")
const boardCss = readCss("components/ChessBoard.css")

function rule(css, selector) {
  const start = css.indexOf(`${selector} {`)
  expect(start, `Missing rule: ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
}

function rgbToken(palette, token) {
  const match = palette.match(new RegExp(`--board-${token}:\\s*#([\\da-f]{6});`, "i"))
  expect(match, `Missing board color: ${token}`).not.toBeNull()
  return match[1].match(/../g).map(channel => Number.parseInt(channel, 16))
}

describe("shared board design", () => {
  it("preserves the light board palette and native light rendering", () => {
    const palette = rule(boardCss, ".chess-board")
    for (const [token, color] of Object.entries({
      light: "#f7fafc",
      dark: "#d9e4ed",
      edge: "#c2d0dc",
      highlight: "#bbcfdc",
      muted: "#526576",
      bg: "#fafcfe",
      text: "#18242f",
    })) {
      expect(palette).toContain(`--board-${token}: ${color};`)
    }
    expect(boardCss).not.toContain("prefers-color-scheme")
    expect(rule(boardCss, ".board-grid")).toContain("color-scheme: light;")
    expect(rule(boardCss, ".board-grid .coord")).toContain("color: var(--board-muted);")
  })

  it("uses the warm board palette only when the page's dark theme is selected", () => {
    const palette = rule(boardCss, ':root[data-theme="dark"] .chess-board')
    for (const [token, color] of Object.entries({
      light: "#dac5a6",
      dark: "#a47c59",
      edge: "#8c6849",
      highlight: "#c5ae78",
      muted: "#241b13",
      bg: "#dac5a6",
      text: "#241b13",
    })) {
      expect(palette).toContain(`--board-${token}: ${color};`)
    }
    // Theme changes alter board tokens, never opacity or filters on its pieces.
    expect(palette).not.toMatch(/(?:^|[;\n])\s*(?:opacity|filter|background)\s*:/)
    expect(rule(boardCss, ".board-grid .piece")).toContain("filter: none;")
    expect(rule(boardCss, ".piece__image")).toContain("filter: none;")
  })

  it("preserves square geometry and color when generic buttons are enlarged or disabled", () => {
    const square = rule(boardCss, ".board-grid .square")
    expect(square).toContain("min-width: 0;")
    expect(square).toContain("min-height: 0;")
    expect(square).toContain("padding: 0;")
    expect(square).toContain("opacity: 1;")
    expect(square).toContain("border-radius: 0;")
    expect(rule(boardCss, ".board-grid .square.light")).toContain("background: var(--board-light);")
    expect(rule(boardCss, ".board-grid .square.dark")).toContain("background: var(--board-dark);")
    expect(rule(boardCss, ".board-grid .square:disabled")).not.toMatch(/opacity|filter|background/)
  })

  it("tints last-move squares without replacing their checkerboard colors or semantic rings", () => {
    // These equally specific selectors must follow the base square colors.
    const lastMoveSelector = ".board-grid .square.square--last-move"
    expect(boardCss.indexOf(lastMoveSelector)).toBeGreaterThan(boardCss.indexOf(".board-grid .square.dark"))
    const lastMove = rule(boardCss, lastMoveSelector)
    expect(lastMove).not.toMatch(/(?:^|[;\n])\s*(?:background|background-color|opacity|filter)\s*:/)
    expect(lastMove).toContain("background-image: linear-gradient(")
    expect(lastMove).toContain("color-mix(in srgb, var(--board-highlight) 25%, transparent)")
    const rings = rule(boardCss, ".square::after")
    for (const state of ["highlight", "capture", "illegal", "suggested"]) {
      expect(rings).toContain(`var(--square-ring-${state})`)
    }
    expect(rule(boardCss, ".board-grid .square--capture")).toContain("--square-capture-overlay:")
    expect(rule(boardCss, ".board-grid .square--illegal")).toContain("rgba(220, 38, 38, 0.95)")
    expect(rule(boardCss, ".board-grid .square--suggested")).toContain("rgba(34, 197, 94, 0.78)")
    expect(rule(boardCss, ".board-grid .square:focus-visible:not(:disabled)")).toContain("outline: 2px solid var(--board-muted);")
  })

  it.each([
    ["light", ".chess-board"],
    ["dark", ':root[data-theme="dark"] .chess-board'],
  ])("keeps a pawn's vacated light square distinct from dark neighbors in the %s theme", (_theme, selector) => {
    const palette = rule(boardCss, selector)
    const lastMove = rule(boardCss, ".board-grid .square.square--last-move")
    const opacity = Number(lastMove.match(/var\(--board-highlight\)\s+([\d.]+)%/)[1]) / 100
    const light = rgbToken(palette, "light"), dark = rgbToken(palette, "dark"), highlight = rgbToken(palette, "highlight")
    const tint = (color) => color.map((channel, i) => channel * (1 - opacity) + highlight[i] * opacity)
    const luminance = (color) => color.reduce((total, channel, i) => total + channel * [0.2126, 0.7152, 0.0722][i], 0)
    const plainGap = luminance(light) - luminance(dark)
    // d5-e4 leaves a highlighted light origin surrounded by plain dark squares.
    // The former 50% tint retained two highlighted colors, but erased this edge.
    expect(luminance(tint(light)) - luminance(dark)).toBeGreaterThan(plainGap * 0.4)
    expect(luminance(tint(light)) - luminance(tint(dark))).toBeGreaterThan(plainGap * 0.4)
    // Both base colors must still receive a visible cue.
    for (const color of [light, dark]) {
      expect(Math.abs(luminance(color) - luminance(tint(color)))).toBeGreaterThan(4)
    }
  })

  it("keeps dark-theme coordinates legible on plain and last-move squares", () => {
    const palette = rule(boardCss, ':root[data-theme="dark"] .chess-board')
    const lastMove = rule(boardCss, ".board-grid .square.square--last-move")
    const opacity = Number(lastMove.match(/var\(--board-highlight\)\s+([\d.]+)%/)[1]) / 100
    const highlight = rgbToken(palette, "highlight")
    const luminance = (color) => color.reduce((total, channel, i) => {
      const srgb = channel / 255
      const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
      return total + linear * [0.2126, 0.7152, 0.0722][i]
    }, 0)
    const textLuminance = luminance(rgbToken(palette, "muted"))
    for (const token of ["light", "dark"]) {
      const color = rgbToken(palette, token)
      const tinted = color.map((channel, i) => channel * (1 - opacity) + highlight[i] * opacity)
      for (const background of [color, tinted]) {
        expect((luminance(background) + 0.05) / (textLuminance + 0.05)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("fills shared grid tracks so fractional sizes cannot leave seams between move rings", () => {
    const grid = rule(boardCss, ".board-grid")
    expect(grid).toContain("grid-template-columns: repeat(8, minmax(0, 1fr));")
    expect(grid).toContain("grid-template-rows: repeat(8, minmax(0, 1fr));")
    expect(grid).toContain("aspect-ratio: 1 / 1;")
    expect(grid).toContain("gap: 0;")
    const square = rule(boardCss, ".board-grid .square")
    expect(square).toContain("height: 100%;")
    expect(square).toContain("aspect-ratio: auto;")
    expect(rule(boardCss, ".square::after")).toContain("inset: 0;")
  })

  it("paints review arrows above occupied squares while containing their layers within the board", () => {
    expect(rule(boardCss, ".chess-board")).toContain("isolation: isolate;")
    const layer = (selector) => {
      const value = rule(boardCss, selector).match(/z-index:\s*(\d+)\s*;/)
      expect(value, `Missing layer: ${selector}`).not.toBeNull()
      return Number(value[1])
    }
    const overlayLayer = layer(".board-overlay")
    for (const selector of [".phantom-piece-on-board", ".board-grid .piece", ".square::after", ".board-grid .coord"]) {
      expect(overlayLayer).toBeGreaterThan(layer(selector))
    }
    expect(rule(boardCss, ".board-overlay")).toContain("pointer-events: none;")
  })

  it("retains translucent arrows and their successful and illegal move colors", () => {
    expect(rule(boardCss, ".board-overlay__arrow")).toContain("opacity: 0.62;")
    for (const [tone, color] of [["illegal", "rgba(220, 38, 38, 0.9)"], ["success", "rgba(34, 197, 94, 0.88)"]]) {
      expect(rule(boardCss, `.board-overlay__arrow--${tone}`)).toContain(`stroke: ${color};`)
      expect(rule(boardCss, `.board-overlay__marker--${tone}`)).toContain(`fill: ${color};`)
    }
  })

  it("retains reachable action targets beside the board at narrow widths", () => {
    const game = readCss("pages/GamePage.css")
    const review = readCss("pages/Review.css")
    const tutor = readCss("pages/Tutor.css")
    for (const [css, selector] of [
      [game, ".game-reserve-piece"],
      [game, ".phantom-menu__close"],
      [game, ".phantom-menu__piece-button"],
      [review, ".review-page__segmented-pill"],
      [review, ".review-page__replay-controls button"],
      [tutor, ".coach-page .coach-icon-button"],
    ]) {
      expect(rule(css, selector)).toContain("min-height: 44px;")
    }
    expect(rule(game, ".game-reserve-pieces")).toContain("repeat(auto-fit, minmax(44px, 1fr))")
    expect(rule(review, ".review-page__segmented-control")).toContain("flex-wrap: wrap;")
    expect(rule(tutor, ".has-sidebar > .coach-sidebar")).toContain("var(--app-header-height, 49px)")
  })

  it("keeps black reserve and phantom thumbnails visible on dark controls", () => {
    for (const [path, selector] of [
      ["components/PhantomTray.css", ".phantom-piece__symbol"],
      ["pages/GamePage.css", ".game-reserve-piece img"],
      ["pages/GamePage.css", ".phantom-menu__piece-symbol"],
      ["pages/Review.css", ".review-page__reserve-piece img"],
    ]) {
      expect(rule(readCss(path), selector)).toContain("background: #f7fafc;")
    }
  })
})
