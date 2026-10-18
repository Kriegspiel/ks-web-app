import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import AppFooter from "../components/AppFooter"

const appCss = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../App.css"), "utf8")

afterEach(() => cleanup())

describe("AppFooter", () => {
  it("uses_regular_weight_for_all_navigation_links_like_the_public_site", () => {
    const style = document.createElement("style")
    style.textContent = appCss
    document.head.append(style)

    try {
      const { container } = render(<AppFooter />)
      const links = container.querySelectorAll(".app-footer__group a")

      expect(links.length).toBeGreaterThan(0)
      for (const link of links) {
        expect(window.getComputedStyle(link).fontWeight, link.textContent).toBe("400")
      }
      expect(window.getComputedStyle(screen.getByRole("link", { name: "Kriegspiel.org" })).fontWeight).toBe("700")
    } finally {
      style.remove()
    }
  })

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

  it("marks_the_development_github_footer_link_as_external", () => {
    render(<AppFooter />)

    const development = screen.getByRole("region", { name: "Development" })
    const githubLink = within(development).getByRole("link", { name: "GitHub" })

    expect(githubLink).toHaveAttribute("href", "https://github.com/Kriegspiel")
    expect(githubLink).toHaveAttribute("target", "_blank")
    expect(githubLink).toHaveAttribute("rel", "noreferrer noopener")
    expect(githubLink.querySelector(".app-footer__external-icon")).toBeNull()
  })
})
