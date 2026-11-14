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
  it("exempts only the header wordmark from page-link underlines and retains keyboard focus", () => {
    const brandRule = blockFor(appCss, ".app-header__brand[href],")
    expect(brandRule).toMatch(/text-decoration-line:\s*none;/)
    expect(appCss).toContain(".app-header__brand[href]:hover,")
    expect(appCss).toContain(".app-header__brand[href]:focus-visible {")
    expect(brandRule).not.toMatch(/outline\s*:/)
    expect(blockFor(baseCss, "a[href] {")).toMatch(/text-decoration-line:\s*underline;/)
    expect(blockFor(baseCss, "a:focus-visible,")).toMatch(/outline:\s*2px solid var\(--text\);/)
    expect(blockFor(appCss, ".app-footer__brand {")).not.toMatch(/text-decoration/)
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
