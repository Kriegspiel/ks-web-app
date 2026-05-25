import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import AppFooter from "../components/AppFooter"

describe("AppFooter", () => {
  it("matches_the_public_site_communication_footer_order", () => {
    render(<AppFooter />)

    const communication = screen.getByRole("region", { name: "Communication" })
    const links = within(communication).getAllByRole("link")

    expect(links.map((link) => link.textContent)).toEqual(["Blog", "Changelog", "RSS", "About"])
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://kriegspiel.org/blog",
      "https://kriegspiel.org/changelog",
      "https://kriegspiel.org/feed.xml",
      "https://kriegspiel.org/about",
    ])
  })
})
