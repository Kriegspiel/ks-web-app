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

    const priceRule = blockFor(subscriptionCss, ".subscription-tier-table__price")
    expect(priceRule).toMatch(/display:\s*grid;/)
    expect(priceRule).toMatch(/justify-items:\s*center;/)
    expect(priceRule).toMatch(/line-height:\s*1\.2;/)

    const stackedPriceRule = blockFor(subscriptionCss, ".subscription-tier-price--stacked")
    expect(stackedPriceRule).toMatch(/white-space:\s*nowrap;/)
  })

  it("makes the current tier badge high contrast", () => {
    const currentLabelRule = blockFor(subscriptionCss, ".subscription-tier-table__current-label")
    expect(currentLabelRule).toMatch(/border:\s*1px solid color-mix\(in srgb, var\(--success\)/)
    expect(currentLabelRule).toMatch(/background:\s*color-mix\(in srgb, var\(--success\)/)
    expect(currentLabelRule).toMatch(/color:\s*var\(--success\);/)
    expect(currentLabelRule).toMatch(/box-shadow:/)
    expect(currentLabelRule).toMatch(/font-weight:\s*800;/)
  })

  it("keeps subscription action buttons readable in dark mode", () => {
    const manageBillingRule = blockFor(subscriptionCss, ".subscription-manage-billing-button")
    expect(manageBillingRule).toMatch(/background:\s*var\(--surface-strong\);/)
    expect(manageBillingRule).toMatch(/color:\s*var\(--text\);/)

    const selectedButtonRule = blockFor(subscriptionCss, ".subscription-tier-table__heading button.is-selected")
    expect(selectedButtonRule).toMatch(/background:\s*var\(--accent\);/)
    expect(selectedButtonRule).toMatch(/color:\s*var\(--bg\);/)
  })

  it("styles the support note as a readable post-table section", () => {
    const supportNoteRule = blockFor(subscriptionCss, ".subscription-support-note")
    expect(supportNoteRule).toMatch(/display:\s*grid;/)
    expect(supportNoteRule).toMatch(/margin-top:\s*1\.15rem;/)
    expect(supportNoteRule).toMatch(/background:\s*color-mix/)

    const supportParagraphRule = blockFor(subscriptionCss, ".subscription-support-note p")
    expect(supportParagraphRule).toMatch(/max-width:\s*58rem;/)
    expect(supportParagraphRule).toMatch(/margin:\s*0;/)
  })
})
