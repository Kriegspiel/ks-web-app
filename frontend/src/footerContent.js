import footerMarkdown from "../../../ks-content/site/footer/README.md?raw"

const feedHref = "https://kriegspiel.org/feed.xml"

const absoluteFooterLinks = new Map([
  ["/playing", "https://kriegspiel.org/playing"],
  ["/rules/berkeley", "https://kriegspiel.org/rules/berkeley"],
  ["/rules/cincinnati", "https://kriegspiel.org/rules/cincinnati"],
  ["/rules/wild16", "https://kriegspiel.org/rules/wild16"],
  ["/rules/rand", "https://kriegspiel.org/rules/rand"],
  ["/rules/english", "https://kriegspiel.org/rules/english"],
  ["/rules/crazykrieg", "https://kriegspiel.org/rules/crazykrieg"],
  ["/rules/comparison/", "https://kriegspiel.org/rules/comparison/"],
  ["/blog", "https://kriegspiel.org/blog"],
  ["/changelog", "https://kriegspiel.org/changelog"],
  ["/feed.xml", feedHref],
  ["/about", "https://kriegspiel.org/about"],
  ["/privacy", "https://kriegspiel.org/privacy"],
  ["/terms", "https://kriegspiel.org/terms"],
])

const requiredRulesLinks = [
  { label: "Berkeley", href: "https://kriegspiel.org/rules/berkeley" },
  { label: "Cincinnati", href: "https://kriegspiel.org/rules/cincinnati" },
  { label: "Wild 16", href: "https://kriegspiel.org/rules/wild16" },
  { label: "RAND", href: "https://kriegspiel.org/rules/rand" },
  { label: "English", href: "https://kriegspiel.org/rules/english" },
  { label: "CrazyKrieg", href: "https://kriegspiel.org/rules/crazykrieg" },
  { label: "Comparison", href: "https://kriegspiel.org/rules/comparison/" },
]

function normalizeFooterLabel(label) {
  return label === "hi@kriegspiel.org" ? "any@kriegspiel.org" : label
}

function normalizeFooterHref(href) {
  const normalized = absoluteFooterLinks.get(href) ?? href
  return normalized === "mailto:hi@kriegspiel.org" ? "mailto:any@kriegspiel.org" : normalized
}

function parseFooterMarkdown(markdown) {
  const groups = []
  let currentGroup = null

  for (const rawLine of String(markdown).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line === "---") {
      continue
    }

    const headingMatch = line.match(/^#\s+(.+)$/)
    if (headingMatch) {
      currentGroup = { title: headingMatch[1].trim(), links: [] }
      groups.push(currentGroup)
      continue
    }

    if (!currentGroup) {
      continue
    }

    const linkMatch = line.match(/^-\s+\[(.+?)\]\((.+?)\)$/)
    if (linkMatch) {
      currentGroup.links.push({ label: normalizeFooterLabel(linkMatch[1]), href: normalizeFooterHref(linkMatch[2]) })
    }
  }

  const rulesGroup = groups.find((group) => group.title === "Rules")
  if (rulesGroup) {
    const existingHrefs = new Set(rulesGroup.links.map((link) => link.href))
    for (const requiredLink of requiredRulesLinks) {
      if (!existingHrefs.has(requiredLink.href)) {
        rulesGroup.links.push(requiredLink)
      }
    }
  }

  return groups
}

function withFeedFooterLink(groups) {
  const communicationGroup = groups.find((group) => group.title.toLowerCase() === "communication")
  if (!communicationGroup) {
    groups.push({
      title: "Communication",
      links: [
        { label: "Blog", href: "https://kriegspiel.org/blog" },
        { label: "Changelog", href: "https://kriegspiel.org/changelog" },
        { label: "RSS", href: feedHref },
        { label: "About", href: "https://kriegspiel.org/about" },
      ],
    })
    return groups
  }

  const feedLink = communicationGroup.links.find((link) => link.href === feedHref) ?? { label: "RSS", href: feedHref }
  const linksWithoutFeed = communicationGroup.links.filter((link) => link.href !== feedHref)
  const aboutIndex = linksWithoutFeed.findIndex((link) => link.href === "https://kriegspiel.org/about")
  linksWithoutFeed.splice(aboutIndex === -1 ? linksWithoutFeed.length : aboutIndex, 0, feedLink)
  communicationGroup.links = linksWithoutFeed
  return groups
}

export const footerGroups = withFeedFooterLink(parseFooterMarkdown(footerMarkdown))
