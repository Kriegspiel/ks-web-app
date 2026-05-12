import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const indexHtmlPath = path.join(process.cwd(), "index.html")
const indexHtml = readFileSync(indexHtmlPath, "utf8")

describe("index.html social metadata", () => {
  it("publishes_large_social_preview_tags_for_link_cards", () => {
    expect(indexHtml).toContain('<meta name="description" content="Play hidden-information chess online with Berkeley, Cincinnati, Wild 16, RAND, English, and CrazyKrieg rulesets." />')
    expect(indexHtml).toContain('<link rel="canonical" href="https://app.kriegspiel.org/" />')
    expect(indexHtml).toContain('<meta property="og:image" content="https://app.kriegspiel.org/social-card-20260511.png" />')
    expect(indexHtml).toContain('<meta property="og:image:width" content="1200" />')
    expect(indexHtml).toContain('<meta property="og:image:height" content="630" />')
    expect(indexHtml).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(indexHtml).toContain('<meta name="twitter:image" content="https://app.kriegspiel.org/social-card-20260511.png" />')
  })
})
