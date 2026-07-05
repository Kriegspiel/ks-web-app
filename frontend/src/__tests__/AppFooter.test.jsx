import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import AppFooter from "../components/AppFooter"

afterEach(() => cleanup())

describe("AppFooter", () => {
  it("matches_the_public_site_communication_footer_order", () => {
    render(<AppFooter />)

    const communication = screen.getByRole("region", { name: "Communication" })
    const links = within(communication).getAllByRole("link")

    expect(links.map((link) => link.textContent.replace(/\u2197/g, ""))).toEqual(["Blog", "Changelog", "RSS", "About"])
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://kriegspiel.org/blog",
      "https://kriegspiel.org/changelog",
      "https://kriegspiel.org/feed.xml",
      "https://kriegspiel.org/about",
    ])
  })

  it("marks_the_development_github_footer_link_as_external", () => {
    render(<AppFooter />)

    const development = screen.getByRole("region", { name: "Development" })
    const githubLink = within(development).getByRole("link", { name: "GitHub" })

    expect(githubLink).toHaveAttribute("href", "https://github.com/Kriegspiel")
    expect(githubLink).toHaveAttribute("target", "_blank")
    expect(githubLink).toHaveAttribute("rel", "noreferrer noopener")
    expect(githubLink.querySelector(".app-footer__external-icon")?.textContent).toBe("\u2197")
  })
})
