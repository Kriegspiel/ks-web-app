import { afterEach, describe, expect, it } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import TechIndexPage from "../pages/TechIndex"

afterEach(() => {
  cleanup()
})

describe("TechIndexPage", () => {
  it("links_to_all_tech_reports", () => {
    render(<MemoryRouter><TechIndexPage /></MemoryRouter>)

    expect(screen.getByRole("heading", { name: "Tech" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Bots report/i })).toHaveAttribute("href", "/tech/bots-report")
    expect(screen.getByRole("link", { name: /Kriegsspiel bot matrix/i })).toHaveAttribute("href", "/tech/bot-matrix")
    expect(screen.getByRole("link", { name: /Guests report/i })).toHaveAttribute("href", "/tech/guests-report")
    expect(screen.getByRole("link", { name: /Users report/i })).toHaveAttribute("href", "/tech/users-report")
    expect(screen.getByRole("link", { name: /Acquisition report/i })).toHaveAttribute("href", "/tech/acquisition-report")
  })
})
