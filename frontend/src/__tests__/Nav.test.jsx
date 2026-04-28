import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import AppHeader from "../components/AppHeader"
import { ThemeProvider } from "../context/ThemeContext"

const mockAuth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null,
  actionLoading: false,
  logout: vi.fn(),
}))

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}))

beforeEach(() => {
  cleanup()
  mockAuth.isAuthenticated = false
  mockAuth.user = null
  mockAuth.actionLoading = false
  mockAuth.logout.mockReset()
  window.localStorage.clear()
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  })
})

afterEach(() => {
  cleanup()
})

describe("Nav", () => {
  it("shows_guest_nav_links", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole("link", { name: "Kriegspiel" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /toggle color theme/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Lobby" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument()
    expect(screen.queryByText("Profile")).not.toBeInTheDocument()
  })

  it("shows_authenticated_lobby_and_profile_menu_without_header_clutter", () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole("link", { name: "Lobby" })).toBeInTheDocument()
    fireEvent.click(screen.getByText("Profile"))

    expect(screen.getByRole("link", { name: "User" })).toHaveAttribute("href", "/user/fil")
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Home" })).not.toBeInTheDocument()
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/active game/i)).not.toBeInTheDocument()
  })

  it("dismisses_the_profile_menu_after_outside_and_menu_clicks", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    const trigger = screen.getByText("Profile")
    const menu = trigger.closest("details")
    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    expect(screen.getByRole("link", { name: "User" })).toBeInTheDocument()

    fireEvent.pointerDown(document.body)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    const userLink = screen.getByRole("link", { name: "User" })
    fireEvent.click(userLink)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    const reopenedUserLink = screen.getByRole("link", { name: "User" })
    const panel = reopenedUserLink.parentElement
    fireEvent.click(panel)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))

    fireEvent.click(trigger)
    await waitFor(() => expect(menu).toHaveAttribute("open"))
    fireEvent.click(screen.getByRole("button", { name: "Logout" }))
    expect(mockAuth.logout).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(menu).not.toHaveAttribute("open"))
  })
})

describe("theme toggle", () => {
  it("defaults_to_light_even_if_system_prefers_dark", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    expect(screen.getByRole("button", { name: /toggle color theme/i })).toHaveAttribute("aria-pressed", "false")
    expect(window.localStorage.getItem("kriegspiel-theme")).toBe("light")
  })

  it("toggles_aria_label_when_pressed", () => {
    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    const toggle = screen.getByRole("button", { name: /toggle color theme/i })
    fireEvent.click(toggle)

    expect(screen.getByRole("button", { name: /toggle color theme/i })).toHaveAttribute("aria-pressed", "true")
  })
})
