import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const indexHtmlPath = path.join(process.cwd(), "index.html")
const indexHtml = readFileSync(indexHtmlPath, "utf8")

describe("index.html social metadata", () => {
  it("publishes_large_social_preview_tags_for_link_cards", () => {
    expect(indexHtml).toContain('<meta name="description" content="Play hidden-information chess online with Berkeley, Cincinnati, Wild 16, RAND, English, and CrazyKrieg rulesets." />')
    expect(indexHtml).toContain('<link rel="canonical" href="https://app.kriegspiel.org/" />')
    expect(indexHtml).toContain('<meta property="og:image:width" content="1200" />')
    expect(indexHtml).toContain('<meta property="og:image:height" content="630" />')
    expect(indexHtml).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })

  it("provides_the_same_current_preview_and_description_without_running_javascript", () => {
    const document = new DOMParser().parseFromString(indexHtml, "text/html")
    const imageUrl = "https://kriegspiel.org/social-card-20261114.png"
    const imageAlt = "Kriegspiel. Chess. Beyond what you can see. A board showing only White’s pieces."

    for (const [attribute, name, content] of [
      ["property", "og:image", imageUrl],
      ["property", "og:image:secure_url", imageUrl],
      ["property", "og:image:type", "image/png"],
      ["property", "og:image:alt", imageAlt],
      ["name", "twitter:image", imageUrl],
      ["name", "twitter:image:alt", imageAlt],
    ]) {
      const tags = document.head.querySelectorAll(`meta[${attribute}="${name}"]`)
      expect(tags).toHaveLength(1)
      expect(tags[0].content).toBe(content)
    }
  })

  it.each([
    ["current", "social-card-20261114.png"],
    ["legacy", "social-card-20260511.png"],
  ])("ships_a_1200_by_630_%s_preview_png", (_, filename) => {
    const image = readFileSync(path.join(process.cwd(), "public", filename))
    expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a")
    expect(image.readUInt32BE(16)).toBe(1200)
    expect(image.readUInt32BE(20)).toBe(630)
  })
})
