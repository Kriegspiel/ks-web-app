import footerMarkdown from "../../../content/site/footer/README.md?raw"

const PUBLIC_SITE_ORIGIN = "https://kriegspiel.org"

function normalizeFooterHref(href) {
  if (/^(?:[a-z]+:)?\/\//i.test(href) || /^[a-z]+:/i.test(href)) {
    return href
  }

  return new URL(href, `${PUBLIC_SITE_ORIGIN}/`).toString()
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
      currentGroup.links.push({
        label: linkMatch[1],
        href: normalizeFooterHref(linkMatch[2]),
      })
    }
  }

  return groups
}

export const footerGroups = parseFooterMarkdown(footerMarkdown)
