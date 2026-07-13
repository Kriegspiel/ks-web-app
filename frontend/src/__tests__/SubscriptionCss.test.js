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

  it("makes the guest subscription notice a prominent yellow warning", () => {
    const warningRule = blockFor(subscriptionCss, ".subscription-notice--warning")
    expect(warningRule).toMatch(/border:\s*2px solid color-mix\(in srgb, #d97706/)
    expect(warningRule).toMatch(/background:\s*linear-gradient/)
    expect(warningRule).toMatch(/#facc15/)
    expect(warningRule).toMatch(/box-shadow:/)

    const warningParagraphRule = blockFor(subscriptionCss, ".subscription-notice--warning p")
    expect(warningParagraphRule).toMatch(/color:\s*color-mix\(in srgb, #3b2500/)
    expect(warningParagraphRule).toMatch(/font-weight:\s*750;/)

    const warningLinkRule = blockFor(subscriptionCss, ".subscription-notice--warning a")
    expect(warningLinkRule).toMatch(/font-weight:\s*850;/)
  })

  it("makes the public subscription invite a prominent yellow callout", () => {
    const inviteRule = blockFor(subscriptionCss, ".subscription-public-invite")
    expect(inviteRule).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto;/)
    expect(inviteRule).toMatch(/border:\s*2px solid color-mix\(in srgb, #d97706/)
    expect(inviteRule).toMatch(/background:\s*linear-gradient/)
    expect(inviteRule).toMatch(/#facc15/)

    const actionsRule = blockFor(subscriptionCss, ".subscription-public-invite__actions")
    expect(actionsRule).toMatch(/display:\s*flex;/)
    expect(actionsRule).toMatch(/justify-content:\s*flex-end;/)
  })

  it("uses a compact tier table and wrapping bot list items", () => {
    const tableRule = blockFor(subscriptionCss, ".subscription-tier-table {")
    expect(tableRule).toMatch(/min-width:\s*64rem;/)

    const featureColumnRule = blockFor(subscriptionCss, ".subscription-tier-table__feature-col")
    expect(featureColumnRule).toMatch(/width:\s*12rem;/)

    const botItemsRule = blockFor(subscriptionCss, ".subscription-bot-list__items")
    expect(botItemsRule).toMatch(/display:\s*flex;/)
    expect(botItemsRule).toMatch(/flex-wrap:\s*wrap;/)
    expect(botItemsRule).toMatch(/align-items:\s*baseline;/)
    expect(botItemsRule).toMatch(/list-style:\s*none;/)
    expect(botItemsRule).toMatch(/margin:\s*0;/)

    const botItemSeparatorRule = blockFor(subscriptionCss, ".subscription-bot-list__items li:not(:last-child)::after")
    expect(botItemSeparatorRule).toMatch(/content:\s*",";/)
    expect(botItemSeparatorRule).toMatch(/color:\s*var\(--muted\);/)

    const priceRule = blockFor(subscriptionCss, ".subscription-tier-table__price")
    expect(priceRule).toMatch(/display:\s*grid;/)
    expect(priceRule).toMatch(/justify-items:\s*center;/)
    expect(priceRule).toMatch(/line-height:\s*1\.2;/)

    const stackedPriceRule = blockFor(subscriptionCss, ".subscription-tier-price--stacked")
    expect(stackedPriceRule).toMatch(/white-space:\s*nowrap;/)

    const textValueRule = blockFor(subscriptionCss, ".subscription-tier-table__text")
    expect(textValueRule).toMatch(/display:\s*block;/)
    expect(textValueRule).toMatch(/line-height:\s*1\.35;/)
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

    const paymentButtonRule = blockFor(subscriptionCss, ".subscription-payment-button")
    expect(paymentButtonRule).toMatch(/background:\s*#050505;/)
    expect(paymentButtonRule).toMatch(/border-color:\s*#050505;/)
    expect(paymentButtonRule).toMatch(/color:\s*#ffffff;/)
    expect(paymentButtonRule).toMatch(/font-weight:\s*800;/)

    const disabledPaymentButtonRule = blockFor(subscriptionCss, ".subscription-payment-button:disabled")
    expect(disabledPaymentButtonRule).toMatch(/background:\s*var\(--surface-strong\);/)
    expect(disabledPaymentButtonRule).toMatch(/color:\s*var\(--muted\);/)

    const selectedColumnRule = blockFor(subscriptionCss, ".subscription-tier-table th.subscription-tier-table__selected-column")
    expect(selectedColumnRule).toMatch(/inset 2px 0 0 var\(--accent\)/)
    expect(selectedColumnRule).toMatch(/inset -2px 0 0 var\(--accent\)/)
    expect(selectedColumnRule).not.toMatch(/inset 0 0 0 2px var\(--accent\)/)

    const selectedHeaderRule = blockFor(subscriptionCss, ".subscription-tier-table thead th.subscription-tier-table__selected-column")
    expect(selectedHeaderRule).toMatch(/inset 0 2px 0 var\(--accent\)/)

    const selectedLastCellRule = blockFor(subscriptionCss, ".subscription-tier-table tbody tr:last-child td.subscription-tier-table__selected-column")
    expect(selectedLastCellRule).toMatch(/inset 0 -2px 0 var\(--accent\)/)

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

    const availabilityNoteRule = blockFor(subscriptionCss, ".subscription-availability-note")
    expect(availabilityNoteRule).toMatch(/display:\s*grid;/)
    expect(availabilityNoteRule).toMatch(/margin-top:\s*0\.85rem;/)
    expect(availabilityNoteRule).toMatch(/background:\s*color-mix/)

    const availabilityLinkRule = blockFor(subscriptionCss, ".subscription-availability-note a")
    expect(availabilityLinkRule).toMatch(/color:\s*var\(--text\);/)
    expect(availabilityLinkRule).toMatch(/font-weight:\s*800;/)
  })
})
