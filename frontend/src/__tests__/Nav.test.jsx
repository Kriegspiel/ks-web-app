import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Lobby" })).not.toBeInTheDocument()
  })

  it("shows_authenticated_links_without_user_or_active_game_clutter", () => {
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
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument()
    expect(screen.queryByText(/signed in as/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/active game/i)).not.toBeInTheDocument()
  })
})

describe("theme toggle", () => {
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
