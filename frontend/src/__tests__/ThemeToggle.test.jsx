import fs from "node:fs"
import { afterEach, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import ThemeToggle from "../components/ThemeToggle"

const toggleTheme = vi.hoisted(() => vi.fn())
vi.mock("../hooks/useTheme", () => ({ useTheme: () => ({ isDark: false, toggleTheme }) }))
afterEach(() => { cleanup(); toggleTheme.mockClear() })

it("keeps the header logo within its transfer budget and preserves theme switching", () => {
  render(<ThemeToggle />)
  const button = screen.getByRole("button", { name: "Toggle color theme" })
  const logo = button.querySelector("img")
  expect(logo).toHaveAttribute("src", "/logo-theme-toggle-96.webp")
  expect(logo).toHaveAttribute("width", "96")
  expect(logo).toHaveAttribute("height", "96")
  const asset = fs.readFileSync("public/logo-theme-toggle-96.webp")
  expect(asset.toString("ascii", 0, 4)).toBe("RIFF")
  expect(asset.toString("ascii", 8, 12)).toBe("WEBP")
  expect(asset.length).toBeLessThan(8192)
  fireEvent.click(button)
  expect(toggleTheme).toHaveBeenCalledOnce()
})
