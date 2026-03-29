import footerMarkdown from "../../../content/site/footer/README.md?raw"

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
      currentGroup.links.push({ label: linkMatch[1], href: linkMatch[2] })
    }
  }

  return groups
}

export const footerGroups = parseFooterMarkdown(footerMarkdown)
