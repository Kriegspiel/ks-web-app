import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it } from "vitest"

const html = readFileSync("index.html", "utf8")
const script = html.match(/<script id="theme-bootstrap">([\s\S]*?)<\/script>/)[1]

describe("theme before React mounts", () => {
  it.each([
    ["dark", "dark", "#100d0a"],
    ["light", "light", "#fafcfe"],
    [null, "light", "#fafcfe"],
    ["invalid", "light", "#fafcfe"],
    [new Error("Storage denied"), "light", "#fafcfe"],
  ])("restores %s without a theme flash", (stored, theme, color) => {
    const meta = {}
    const document = { documentElement: { dataset: {}, style: {} }, querySelector: () => meta }
    const localStorage = { getItem: () => {
      if (stored instanceof Error) throw stored
      return stored
    } }
    runInNewContext(script, { document, localStorage })
    expect(document.documentElement.dataset.theme).toBe(theme)
    expect(document.documentElement.style.colorScheme).toBe(theme)
    expect(meta.content).toBe(color)
    expect(html.indexOf('id="theme-bootstrap"')).toBeLessThan(html.indexOf('type="module"'))
  })
})
