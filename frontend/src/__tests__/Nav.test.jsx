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

const mockApi = vi.hoisted(() => ({
  getMyGames: vi.fn(),
}))

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}))

vi.mock("../services/api", () => mockApi)

beforeEach(() => {
  cleanup()
  mockAuth.isAuthenticated = false
  mockAuth.user = null
  mockAuth.actionLoading = false
  mockAuth.logout.mockReset()
  mockApi.getMyGames.mockReset()
  mockApi.getMyGames.mockResolvedValue({ games: [] })
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
    expect(screen.getByRole("link", { name: "Rules" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Login" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Register" })).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "Lobby" })).not.toBeInTheDocument()
  })

  it("shows_authenticated_links_with_active_game_indicator", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }
    mockApi.getMyGames.mockResolvedValue({
      games: [{ game_id: "game-99", game_code: "KSP550", state: "active" }],
    })

    render(
      <ThemeProvider>
        <MemoryRouter>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Lobby" })).toBeInTheDocument()
      expect(screen.getByRole("link", { name: /Active game \(KSP550\)/i })).toHaveAttribute("href", "/game/game-99")
    })
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
