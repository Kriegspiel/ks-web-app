import footerMarkdown from "../../../content/site/footer/README.md?raw"

const absoluteFooterLinks = new Map([
  ["/rules/berkeley", "https://kriegspiel.org/rules/berkeley"],
  ["/rules/wild16", "https://kriegspiel.org/rules/wild16"],
  ["/rules/comparison/", "https://kriegspiel.org/rules/comparison/"],
  ["/blog", "https://kriegspiel.org/blog"],
  ["/changelog", "https://kriegspiel.org/changelog"],
  ["/about", "https://kriegspiel.org/about"],
  ["/privacy", "https://kriegspiel.org/privacy"],
  ["/terms", "https://kriegspiel.org/terms"],
])

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

  return groups
}

export const footerGroups = parseFooterMarkdown(footerMarkdown)
