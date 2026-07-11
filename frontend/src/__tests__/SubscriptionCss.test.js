import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

const subscriptionCssPath = resolve(dirname(fileURLToPath(import.meta.url)), "../pages/Subscription.css")
const subscriptionCss = readFileSync(subscriptionCssPath, "utf8")

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

describe("Subscription CSS", () => {
  it("keeps notice text vertically centered within the notice padding", () => {
    const noticeParagraphRule = blockFor(subscriptionCss, ".subscription-notice p")
    expect(noticeParagraphRule).toMatch(/margin:\s*0;/)
  })

  it("uses a compact tier table and stacked bot list items", () => {
    const tableRule = blockFor(subscriptionCss, ".subscription-tier-table {")
    expect(tableRule).toMatch(/min-width:\s*64rem;/)

    const featureColumnRule = blockFor(subscriptionCss, ".subscription-tier-table__feature-col")
    expect(featureColumnRule).toMatch(/width:\s*12rem;/)

    const botItemsRule = blockFor(subscriptionCss, ".subscription-bot-list__items")
    expect(botItemsRule).toMatch(/display:\s*grid;/)
    expect(botItemsRule).toMatch(/list-style:\s*none;/)
    expect(botItemsRule).toMatch(/margin:\s*0;/)
  })
})
