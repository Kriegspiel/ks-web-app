import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const appCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../App.css")
const appCss = readFileSync(appCssPath, "utf8")
const baseCss = readFileSync(resolve(dirname(appCssPath), "index.css"), "utf8")

function blockFor(source, token) {
  const start = source.indexOf(token)
  expect(start).toBeGreaterThanOrEqual(0)

  const open = source.indexOf("{", start)
  expect(open).toBeGreaterThanOrEqual(0)

  let depth = 0
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (character === "{") {
      depth += 1
    } else if (character === "}") {
      depth -= 1
      if (depth === 0) {
        return source.slice(open + 1, index)
      }
    }
  }

  throw new Error(`Unable to find CSS block for ${token}`)
}

describe("Auth layout CSS", () => {
  it("keeps button-style navigation plain in every interaction state without removing focus", () => {
    for (const selector of ["a.button-link[href]", ".inline-links a[href]", "a.lobby-toast__action[href]"]) {
      for (const state of ["", ":hover", ":focus-visible"]) {
        const linkRule = blockFor(baseCss, `${selector}${state}`)
        expect(linkRule).toMatch(/text-decoration-line:\s*none;/)
        expect(linkRule).not.toMatch(/outline\s*:/)
      }
    }
    expect(blockFor(baseCss, "a[href] {")).toMatch(/text-decoration-line:\s*underline;/)
    expect(blockFor(baseCss, "a:focus-visible,")).toMatch(/outline:\s*2px solid var\(--text\);/)
  })

  it("exempts header and footer links while retaining body underlines and keyboard focus", () => {
    for (const landmark of [".app-header", ".app-footer"]) {
      for (const state of ["", ":hover", ":focus-visible"]) {
        const linkRule = blockFor(appCss, `${landmark} a[href]${state}`)
        expect(linkRule).toMatch(/text-decoration-line:\s*none;/)
        expect(linkRule).not.toMatch(/outline\s*:/)
      }
    }
    expect(blockFor(baseCss, "a[href] {")).toMatch(/text-decoration-line:\s*underline;/)
    expect(blockFor(baseCss, "a:focus-visible,")).toMatch(/outline:\s*2px solid var\(--text\);/)
  })

  it("aligns the page to the site shell and bounds its forms", () => {
    const authPageRule = blockFor(appCss, ".page-shell.auth-page")
    expect(authPageRule).toMatch(/max-width:\s*var\(--page-width\);/)

    const authFormRule = blockFor(appCss, ".auth-form {")
    expect(authFormRule).toMatch(/padding:\s*0;/)
    expect(authFormRule).toMatch(/max-width:\s*42rem;/)
    expect(authFormRule).not.toMatch(/padding:\s*[^;]*1\.25rem/)

    const authPromptLinkRule = blockFor(appCss, ".auth-switch-prompt a")
    expect(authPromptLinkRule).toMatch(/color:\s*inherit;/)
    expect(authPromptLinkRule).toMatch(/font-weight:\s*inherit;/)

    const legalNoticeRule = blockFor(appCss, ".auth-legal-notice")
    expect(legalNoticeRule).toMatch(/max-width:\s*42rem;/)
  })
})
