import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const profileCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../pages/Profile.css")
const profileCss = readFileSync(profileCssPath, "utf8")

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

describe("Profile bot metrics CSS", () => {
  it("keeps mobile bot metric rows compact", () => {
    const rowRule = blockFor(profileCss, ".profile-bot-mini-list > div,\n.profile-bot-row-list li")
    expect(rowRule).toMatch(/display:\s*grid;/)
    expect(rowRule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/)
    expect(rowRule).not.toMatch(/flex-direction:\s*column/)
    expect(rowRule).not.toMatch(/justify-content:\s*space-between/)

    const mobileRule = blockFor(profileCss, "@media (max-width: 700px)")
    const mobileRowRule = blockFor(mobileRule, ".profile-bot-mini-list > div,\n  .profile-bot-row-list li")
    expect(mobileRowRule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/)
    expect(mobileRowRule).not.toMatch(/flex-direction:\s*column/)
    expect(mobileRowRule).not.toMatch(/justify-content:\s*space-between/)
  })
})
