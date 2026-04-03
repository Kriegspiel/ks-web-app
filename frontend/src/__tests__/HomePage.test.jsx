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
  userApi: {
    getGameHistory: vi.fn(),
  },
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
  mockApi.userApi.getGameHistory.mockReset()
  mockApi.userApi.getGameHistory.mockResolvedValue({ games: [] })
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
    expect(screen.getByText("v. 1.1.6 / v. 1.0.0")).toBeInTheDocument()
  })

  it("routes_authenticated_play_now_to_lobby_when_no_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil", stats: { elo: 1337, elo_peak: 1402, games_played: 12, games_won: 7, games_lost: 3, games_drawn: 2 } }

    renderPage()

    await waitFor(() => {
      expect(mockApi.getMyGames).toHaveBeenCalledTimes(1)
      expect(mockApi.userApi.getGameHistory).toHaveBeenCalledWith("fil", 1, 20)
    })

    expect(screen.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/lobby")
    expect(screen.getByText("1337")).toBeInTheDocument()
  })

  it("shows_recent_games_and_resume_cta_for_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = { username: "fil", stats: { elo: 1345, elo_peak: 1402, games_played: 12, games_won: 7, games_lost: 3, games_drawn: 2 } }
    mockApi.getMyGames.mockResolvedValue({
      games: [
        { game_id: "game-1", game_code: "ABCD12", state: "active", updated_at: "2026-03-26T15:00:00Z" },
        { game_id: "game-2", game_code: "EFGH34", state: "completed", updated_at: "2026-03-25T15:00:00Z" },
      ],
    })
    mockApi.userApi.getGameHistory.mockResolvedValue({
      games: [
        { game_id: "h1", played_at: "2026-03-21T12:00:00Z", elo_after: 1320, elo_delta: 16 },
        { game_id: "h2", played_at: "2026-03-25T12:00:00Z", elo_after: 1345, elo_delta: 25 },
      ],
    })

    renderPage()

    await screen.findByRole("link", { name: "Resume active game" })

    expect(screen.getByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/game-1")
    expect(screen.getByText("ABCD12")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Latest 1345")).toBeInTheDocument()
  })
})
