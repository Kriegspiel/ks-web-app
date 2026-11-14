import { Children, cloneElement } from "react"

// Direct children are the visible profile sections; optional null/false children
// are omitted before counting. Child components must forward className.
export default function ProfileSections({ children }) {
  const sections = Children.toArray(children)
  const statsIndex = sections.findIndex((section) => section.props["data-profile-section"] === "stats")
  if (statsIndex === -1) return sections

  return sections.map((section, index) => cloneElement(section, {
    className: [section.props.className, Math.abs(index - statsIndex) % 2 === 0 ? "profile-card--accent" : ""].filter(Boolean).join(" "),
  }))
}
