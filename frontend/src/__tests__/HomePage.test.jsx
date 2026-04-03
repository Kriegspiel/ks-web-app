import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import HomePage from "../pages/HomePage"

const mockAuth = vi.hoisted(() => ({
  isAuthenticated: false,
  user: null,
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
  mockApi.getMyGames.mockReset()
  mockApi.getMyGames.mockResolvedValue({ games: [] })
})

afterEach(() => {
  cleanup()
})

function renderPage() {
  render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  )
}

describe("HomePage", () => {
  it("routes_guest_play_now_to_login", () => {
    renderPage()

    expect(screen.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/auth/login")
    expect(screen.getByRole("link", { name: "Read rules" })).toHaveAttribute("href", "/rules")
    expect(screen.getByText("v. 1.0.13")).toBeInTheDocument()
  })

  it("routes_authenticated_play_now_to_lobby_when_no_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }

    renderPage()

    await waitFor(() => {
      expect(mockApi.getMyGames).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/lobby")
  })

  it("shows_recent_games_and_resume_cta_for_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil" }
    mockApi.getMyGames.mockResolvedValue({
      games: [
        { game_id: "game-1", game_code: "ABCD12", state: "active", updated_at: "2026-03-26T15:00:00Z" },
        { game_id: "game-2", game_code: "EFGH34", state: "completed", updated_at: "2026-03-25T15:00:00Z" },
      ],
    })

    renderPage()

    await screen.findByRole("link", { name: "Resume active game" })

    expect(screen.getByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/game-1")
    expect(screen.getByText("ABCD12")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
  })
})
