import { afterEach, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import ProfileSections from "../components/ProfileSections"

afterEach(cleanup)

it("leaves sections unchanged when the Stats anchor is absent", () => {
  render(<ProfileSections><section aria-label="Loading" className="profile-card">Loading…</section></ProfileSections>)
  expect(screen.getByRole("region", { name: "Loading" })).toHaveAttribute("class", "profile-card")
})
