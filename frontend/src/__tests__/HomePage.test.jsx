import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import HomePage from "../pages/HomePage"
import { TEST_VERSION_STAMP } from "../version"

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
    expect(screen.getByRole("link", { name: "Read rules (opens external page)" })).toHaveAttribute("href", "https://kriegspiel.org/rules")
    expect(screen.getByRole("link", { name: "Read rules (opens external page)" })).toHaveAttribute("target", "_blank")
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
  })

  it("routes_authenticated_play_now_to_lobby_when_no_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = {
      username: "fil",
      stats: {
        elo: 1337,
        elo_peak: 1402,
        ratings: {
          overall: { elo: 1337, peak: 1402 },
          vs_humans: { elo: 1310, peak: 1360 },
          vs_bots: { elo: 1388, peak: 1400 },
        },
        games_played: 12,
        games_won: 7,
        games_lost: 3,
        games_drawn: 2,
      },
    }

    renderPage()

    await waitFor(() => {
      expect(mockApi.getMyGames).toHaveBeenCalledTimes(1)
      expect(mockApi.userApi.getGameHistory).toHaveBeenCalledWith("fil", 1, 100)
    })

    expect(screen.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/lobby")
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard")
    expect(screen.getByText("1337")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results" })).toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getAllByText("0 (0.0%)").length).toBeGreaterThanOrEqual(3)
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    expect(screen.getByText("1310")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "vs Bots" }))
    expect(screen.getByText("1388")).toBeInTheDocument()
  })

  it("shows_recent_games_and_resume_cta_for_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = {
      username: "fil",
      stats: {
        elo: 1345,
        elo_peak: 1402,
        ratings: {
          overall: { elo: 1345, peak: 1402 },
          vs_humans: { elo: 1321, peak: 1361 },
          vs_bots: { elo: 1390, peak: 1404 },
        },
        games_played: 12,
        games_won: 7,
        games_lost: 3,
        games_drawn: 2,
      },
    }
    mockApi.getMyGames.mockResolvedValue({
      games: [
        {
          game_id: "game-1",
          game_code: "ABCD12",
          state: "active",
          updated_at: "2026-03-26T15:00:00Z",
          white: { username: "randobot", role: "bot" },
          black: { username: "fil", role: "user" },
        },
        {
          game_id: "game-2",
          game_code: "EFGH34",
          state: "completed",
          updated_at: "2026-03-25T15:00:00Z",
          white: { username: "fil", role: "user" },
          black: { username: "amy", role: "user" },
        },
      ],
    })
    mockApi.userApi.getGameHistory.mockResolvedValue({
      games: [
        { game_id: "h1", played_at: "2026-03-21T12:00:00Z", elo_after: 1320, elo_delta: 16, opponent_role: "bot", result: "win" },
        { game_id: "h2", played_at: "2026-03-25T12:00:00Z", elo_after: 1345, elo_delta: 25, opponent_role: "user", result: "loss" },
      ],
    })

    renderPage()

    await screen.findByRole("link", { name: "Resume active game" })

    expect(screen.getByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/game-1")
    expect(screen.getByText("ABCD12")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "randobot (bot)" })).toHaveAttribute("href", "/user/randobot")
    expect(screen.getAllByRole("link", { name: "fil" })[0]).toHaveAttribute("href", "/user/fil")
    expect(screen.getByText(/2026-03-26 15:00:00 UTC/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall rating" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Overall Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Latest 1345")).toBeInTheDocument()
    expect(screen.getAllByText("2026-03-25").length).toBeGreaterThan(0)
    expect(screen.getByText("2")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Game number" }))
    expect(screen.getAllByText("Game 2").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    expect(screen.getByRole("heading", { name: "vs Humans rating" })).toBeInTheDocument()
    expect(screen.getByText("1321")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Humans results" })).toBeInTheDocument()
    expect(screen.getAllByText("1").length).toBeGreaterThan(0)
    expect(screen.getByRole("img", { name: "vs Humans Elo rating over time" })).toBeInTheDocument()
  })
})
