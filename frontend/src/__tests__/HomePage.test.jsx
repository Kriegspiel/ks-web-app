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
    getProfile: vi.fn(),
    getGameHistory: vi.fn(),
    getRatingHistory: vi.fn(),
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
  mockApi.userApi.getProfile.mockReset()
  mockApi.userApi.getProfile.mockResolvedValue({ username: "fil", stats: { ratings: { overall: { elo: 1200, peak: 1200 }, vs_humans: { elo: 1200, peak: 1200 }, vs_bots: { elo: 1200, peak: 1200 } }, results: { overall: { games_played: 0, games_won: 0, games_lost: 0, games_drawn: 0 }, vs_humans: { games_played: 0, games_won: 0, games_lost: 0, games_drawn: 0 }, vs_bots: { games_played: 0, games_won: 0, games_lost: 0, games_drawn: 0 } } } })
  mockApi.userApi.getGameHistory.mockReset()
  mockApi.userApi.getGameHistory.mockResolvedValue({ games: [] })
  mockApi.userApi.getRatingHistory.mockReset()
  mockApi.userApi.getRatingHistory.mockResolvedValue({ series: { game: [], date: [] } })
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
      stats: {},
    }
    mockApi.userApi.getProfile.mockResolvedValue({
      username: "fil",
      stats: {
        ratings: {
          overall: { elo: 1337, peak: 1402 },
          vs_humans: { elo: 1310, peak: 1360 },
          vs_bots: { elo: 1388, peak: 1400 },
        },
        results: {
          overall: { games_played: 12, games_won: 7, games_lost: 3, games_drawn: 2 },
          vs_humans: { games_played: 5, games_won: 3, games_lost: 1, games_drawn: 1 },
          vs_bots: { games_played: 7, games_won: 4, games_lost: 2, games_drawn: 1 },
        },
      },
    })
    mockApi.userApi.getRatingHistory.mockResolvedValue({
      series: {
        game: [],
        date: [],
      },
    })

    renderPage()

    await waitFor(() => {
      expect(mockApi.getMyGames).toHaveBeenCalledTimes(1)
      expect(mockApi.userApi.getProfile).toHaveBeenCalledWith("fil")
      expect(mockApi.userApi.getRatingHistory).toHaveBeenCalledWith("fil", "overall", 100)
    })

    expect(screen.getByRole("link", { name: "Play now" })).toHaveAttribute("href", "/lobby")
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard")
    expect(screen.getByText("1337")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results" })).toBeInTheDocument()
    expect(screen.getByText("12")).toBeInTheDocument()
    expect(screen.getByText("7 (58.3%)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    expect(screen.getByText("1310")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "vs Bots" }))
    expect(screen.getByText("1388")).toBeInTheDocument()
  })

  it("shows_recent_games_and_resume_cta_for_active_game", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = {
      username: "fil",
      stats: {},
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
    mockApi.userApi.getProfile.mockResolvedValue({
      username: "fil",
      stats: {
        ratings: {
          overall: { elo: 1345, peak: 1402 },
          vs_humans: { elo: 1321, peak: 1361 },
          vs_bots: { elo: 1390, peak: 1404 },
        },
        results: {
          overall: { games_played: 12, games_won: 7, games_lost: 3, games_drawn: 2 },
          vs_humans: { games_played: 1, games_won: 0, games_lost: 1, games_drawn: 0 },
          vs_bots: { games_played: 11, games_won: 7, games_lost: 2, games_drawn: 2 },
        },
      },
    })
    mockApi.userApi.getRatingHistory.mockResolvedValue({
      series: {
        game: [
          { label: "Game 1", elo: 1320, delta: 16, played_at: "2026-03-21T12:00:00Z", game_number: 1 },
          { label: "Game 2", elo: 1345, delta: 25, played_at: "2026-03-25T12:00:00Z", game_number: 2 },
        ],
        date: [
          { label: "2026-03-21", elo: 1320, delta: 16, played_at: "2026-03-21T12:00:00Z", game_number: 1 },
          { label: "2026-03-25", elo: 1345, delta: 25, played_at: "2026-03-25T12:00:00Z", game_number: 2 },
        ],
      },
    })

    renderPage()

    await screen.findByRole("link", { name: "Resume active game" })

    expect(screen.getByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/ABCD12")
    expect(screen.getByText("ABCD12")).toBeInTheDocument()
    expect(screen.getByText("Active")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "randobot (bot)" })).toHaveAttribute("href", "/user/randobot")
    expect(screen.getAllByRole("link", { name: "fil" })[0]).toHaveAttribute("href", "/user/fil")
    expect(screen.getByRole("link", { name: "View all games" })).toHaveAttribute("href", "/user/fil/games")
    expect(screen.getByText(/2026-03-26 15:00:00 UTC/)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall rating" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Overall Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Latest 1345")).toBeInTheDocument()
    expect(screen.getAllByText("2026-03-25").length).toBeGreaterThan(0)
    expect(screen.getByText("12")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Game number" }))
    expect(screen.getAllByText("Game 2").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    await waitFor(() => expect(mockApi.userApi.getRatingHistory).toHaveBeenCalledWith("fil", "vs_humans", 100))
    expect(screen.getByRole("heading", { name: "vs Humans rating" })).toBeInTheDocument()
    expect(screen.getByText("1321")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Humans results" })).toBeInTheDocument()
    expect(screen.getAllByText("1").length).toBeGreaterThan(0)
  })

  it("skips_profile_requests_when_the_authenticated_user_has_no_username", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = {
      stats: {
        ratings: { overall: { elo: 1200, peak: 1200 } },
        results: { overall: { games_played: 0, games_won: 0, games_lost: 0, games_drawn: 0 } },
      },
    }
    mockApi.getMyGames.mockResolvedValue({
      games: [
        {
          game_id: "game-no-code",
          state: "active",
          white: {},
          black: null,
        },
      ],
    })

    renderPage()

    await waitFor(() => {
      expect(mockApi.getMyGames).toHaveBeenCalledTimes(1)
    })

    expect(mockApi.userApi.getProfile).not.toHaveBeenCalled()
    expect(mockApi.userApi.getRatingHistory).not.toHaveBeenCalled()
    expect(screen.getByText("Welcome back, player.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/game-no-code")
    expect(screen.queryByRole("link", { name: "View all games" })).not.toBeInTheDocument()
    expect(screen.getByText(/Waiting… vs Waiting…/)).toBeInTheDocument()
  })

  it("shows_the_default_recent_games_error_when_loading_fails_without_details", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = {
      username: "fil",
      stats: {},
    }
    mockApi.getMyGames.mockRejectedValue({})

    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your games right now.")
  })

  it("falls_back_when_games_payloads_and_rating_series_are_missing", async () => {
    mockAuth.isAuthenticated = true
    mockAuth.user = {
      username: "fil",
      stats: {},
    }
    mockApi.getMyGames.mockResolvedValue({})
    mockApi.userApi.getProfile.mockResolvedValue({ username: "fil", stats: {} })
    mockApi.userApi.getRatingHistory.mockResolvedValue(null)

    renderPage()

    await screen.findByRole("link", { name: "Play now" })

    expect(screen.getByText("No games yet. Start one from the lobby.")).toBeInTheDocument()
    expect(mockApi.userApi.getRatingHistory).toHaveBeenCalledWith("fil", "overall", 100)
  })
})
