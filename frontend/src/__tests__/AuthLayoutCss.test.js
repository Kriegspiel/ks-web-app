import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const appCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../App.css")
const appCss = readFileSync(appCssPath, "utf8")

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
  it("keeps auth pages in one aligned column", () => {
    const authPageRule = blockFor(appCss, ".page-shell.auth-page")
    expect(authPageRule).toMatch(/42rem/)

    const authFormRule = blockFor(appCss, ".auth-form {")
    expect(authFormRule).toMatch(/padding:\s*0;/)
    expect(authFormRule).not.toMatch(/padding:\s*[^;]*1\.25rem/)
  })
})
