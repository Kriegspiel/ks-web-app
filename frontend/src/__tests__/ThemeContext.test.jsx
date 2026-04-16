import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, renderHook, screen } from "@testing-library/react"
import { THEME_STORAGE_KEY, ThemeProvider } from "../context/ThemeContext"
import { useTheme } from "../hooks/useTheme"

function ThemeProbe() {
  const { theme, isDark, setTheme, toggleTheme } = useTheme()

  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="is-dark">{String(isDark)}</span>
      <button type="button" onClick={() => toggleTheme()}>toggle</button>
      <button type="button" onClick={() => setTheme("dark")}>set-dark</button>
      <button type="button" onClick={() => setTheme("invalid")}>set-invalid</button>
    </div>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.removeAttribute("data-theme")
  document.documentElement.style.colorScheme = ""
  document.body.removeAttribute("data-theme")
  document.head.innerHTML = ""
})

describe("ThemeProvider", () => {
  it("hydrates_from_storage_and_updates_the_document_theme", () => {
    const metaThemeColor = document.createElement("meta")
    metaThemeColor.setAttribute("name", "theme-color")
    document.head.append(metaThemeColor)
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark")

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId("theme")).toHaveTextContent("dark")
    expect(screen.getByTestId("is-dark")).toHaveTextContent("true")
    expect(document.documentElement.dataset.theme).toBe("dark")
    expect(document.documentElement.style.colorScheme).toBe("dark")
    expect(document.body).toHaveAttribute("data-theme", "dark")
    expect(metaThemeColor).toHaveAttribute("content", "#100d0a")

    fireEvent.click(screen.getByRole("button", { name: "toggle" }))

    expect(screen.getByTestId("theme")).toHaveTextContent("light")
    expect(screen.getByTestId("is-dark")).toHaveTextContent("false")
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light")
    expect(metaThemeColor).toHaveAttribute("content", "#f7efe3")

    fireEvent.click(screen.getByRole("button", { name: "set-invalid" }))
    expect(screen.getByTestId("theme")).toHaveTextContent("light")
  })

  it("falls_back_to_light_theme_when_storage_access_fails", () => {
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(screen.getByTestId("theme")).toHaveTextContent("light")

    fireEvent.click(screen.getByRole("button", { name: "set-dark" }))
    expect(screen.getByTestId("theme")).toHaveTextContent("dark")

    fireEvent.click(screen.getByRole("button", { name: "toggle" }))
    expect(screen.getByTestId("theme")).toHaveTextContent("light")

    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
  })

  it("throws_when_use_theme_is_called_outside_the_provider", () => {
    expect(() => renderHook(() => useTheme())).toThrow("useTheme must be used within a ThemeProvider")
  })
})
