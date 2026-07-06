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
  it("styles the user metrics card as a designed metrics module", () => {
    const metricsCardRule = blockFor(profileCss, ".profile-card--user-metrics")
    expect(metricsCardRule).toMatch(/border-color:\s*color-mix/)
    expect(metricsCardRule).toMatch(/box-shadow:\s*inset 0 0\.18rem 0/)

    const metricsTileRule = blockFor(profileCss, ".profile-card--user-metrics .profile-stats-grid > div")
    expect(metricsTileRule).toMatch(/display:\s*grid;/)
    expect(metricsTileRule).toMatch(/grid-template-rows:\s*auto 1fr;/)
    expect(metricsTileRule).toMatch(/background:\s*[\s\S]*linear-gradient/)
    expect(metricsTileRule).not.toMatch(/--metric-accent/)

    const metricsLabelRule = blockFor(profileCss, ".profile-card--user-metrics .profile-stats-grid dt")
    expect(metricsLabelRule).toMatch(/letter-spacing:\s*0;/)

    const metricsValueRule = blockFor(profileCss, ".profile-card--user-metrics .profile-stats-grid dd")
    expect(metricsValueRule).toMatch(/align-self:\s*end;/)
    expect(profileCss).not.toMatch(/\.profile-metric-tile--/)
    expect(profileCss).not.toMatch(/\.profile-card--user-metrics \.profile-stats-grid > div::before/)

    expect(profileCss).toMatch(
      /\n\.profile-bot-row-link\s*\{\s*font-weight:\s*400;\s*text-decoration-line:\s*underline;/,
    )
  })

  it("lets color split labels wrap as whole words", () => {
    const colorSplitRule = blockFor(profileCss, ".profile-bot-mini-list > div")
    expect(colorSplitRule).toMatch(/display:\s*flex;/)
    expect(colorSplitRule).toMatch(/flex-wrap:\s*wrap;/)
    expect(colorSplitRule).toMatch(/justify-content:\s*space-between;/)
    expect(colorSplitRule).not.toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/)

    const colorSplitLabelRule = blockFor(profileCss, ".profile-bot-mini-list dt {")
    expect(colorSplitLabelRule).toMatch(/flex:\s*0 0 auto;/)
    expect(colorSplitLabelRule).toMatch(/overflow-wrap:\s*normal;/)
  })

  it("keeps mobile opponent and ruleset rows compact", () => {
    const rowRule = blockFor(profileCss, ".profile-bot-row-list li")
    expect(rowRule).toMatch(/display:\s*grid;/)
    expect(rowRule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/)
    expect(rowRule).not.toMatch(/flex-direction:\s*column/)
    expect(rowRule).not.toMatch(/justify-content:\s*space-between/)

    const mobileRule = blockFor(profileCss, "@media (max-width: 700px)")
    const mobileRowRule = blockFor(mobileRule, ".profile-bot-row-list li")
    expect(mobileRowRule).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\) auto;/)
    expect(mobileRowRule).not.toMatch(/flex-direction:\s*column/)
    expect(mobileRowRule).not.toMatch(/justify-content:\s*space-between/)
  })
})
