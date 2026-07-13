import { describe, expect, it } from "vitest"
import {
  normalizeFooterHref,
  normalizeFooterLabel,
  parseFooterMarkdown,
  withFeedFooterLink,
} from "../footerContent"

describe("footer content helpers", () => {
  it("normalizes_legacy_labels_hrefs_and_adds_required_rule_links", () => {
    const groups = parseFooterMarkdown([
      "---",
      "ignored before heading",
      "# Rules",
      "- [Berkeley](/rules/berkeley)",
      "# Contact",
      "- [hi@kriegspiel.org](mailto:hi@kriegspiel.org)",
    ].join("\n"))

    expect(normalizeFooterLabel("hi@kriegspiel.org")).toBe("any@kriegspiel.org")
    expect(normalizeFooterHref("mailto:hi@kriegspiel.org")).toBe("mailto:any@kriegspiel.org")
    expect(groups[0].links.map((link) => link.label)).toContain("CrazyKrieg")
    expect(groups[1].links).toEqual([
      { label: "any@kriegspiel.org", href: "mailto:any@kriegspiel.org" },
    ])
  })

  it("adds_or_repositions_the_feed_link_for_communication_groups", () => {
    expect(withFeedFooterLink([{ title: "Social", links: [] }])).toEqual([
      { title: "Social", links: [] },
      {
        title: "Communication",
        links: [
          { label: "Blog", href: "https://kriegspiel.org/blog" },
          { label: "Changelog", href: "https://kriegspiel.org/changelog" },
          { label: "RSS", href: "https://kriegspiel.org/feed.xml" },
          { label: "About", href: "https://kriegspiel.org/about" },
        ],
      },
    ])

    const groups = withFeedFooterLink([
      {
        title: "Communication",
        links: [{ label: "Blog", href: "https://kriegspiel.org/blog" }],
      },
    ])
    expect(groups[0].links.map((link) => link.label)).toEqual(["Blog", "RSS"])
  })
})
