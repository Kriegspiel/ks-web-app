import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import ProfilePage from "../pages/Profile"

const mockApi = vi.hoisted(() => ({
  userApi: {
    getProfile: vi.fn(),
    getGameHistory: vi.fn(),
    getRatingHistory: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.userApi.getProfile.mockReset()
  mockApi.userApi.getGameHistory.mockReset()
  mockApi.userApi.getRatingHistory.mockReset()
})

function renderProfile(path = "/user/fil") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/user/:username" element={<ProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProfilePage", () => {
  it("renders_profile_stats_and_recent_games", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "fil",
      member_since: "2026-01-01T00:00:00Z",
      stats: {
        elo: 1345,
        elo_peak: 1401,
        results: {
          overall: { games_played: 10, games_won: 6, games_lost: 3, games_drawn: 1 },
          vs_humans: { games_played: 1, games_won: 1, games_lost: 0, games_drawn: 0 },
          vs_bots: { games_played: 9, games_won: 5, games_lost: 3, games_drawn: 1 },
        },
        ratings: {
          overall: { elo: 1345, peak: 1401 },
          vs_humans: { elo: 1290, peak: 1325 },
          vs_bots: { elo: 1410, peak: 1412 },
        },
      },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-legacy-bot",
          result: "win",
          opponent: "legacybot",
          opponent_role: "bot",
          played_at: "2026-03-20T12:00:00Z",
          elo_after: 1500,
          elo_delta: 30,
          rating_snapshot: {
            overall: { elo_after: 1500, elo_delta: 30 },
            vs_humans: { elo_after: null, elo_delta: null },
            vs_bots: { elo_after: null, elo_delta: null },
          },
        },
        {
          game_id: "g-1",
          result: "win",
          opponent: "amy",
          opponent_role: "user",
          played_at: "2026-03-21T12:00:00Z",
          elo_after: 1320,
          elo_delta: 16,
          rating_snapshot: {
            overall: { elo_after: 1320, elo_delta: 16 },
            vs_humans: { elo_after: 1290, elo_delta: 16 },
            vs_bots: { elo_after: null, elo_delta: null },
          },
        },
        {
          game_id: "g-2",
          result: "loss",
          opponent: "bob",
          opponent_role: "bot",
          played_at: "2026-03-25T12:00:00Z",
          elo_after: 1345,
          elo_delta: 25,
          rating_snapshot: {
            overall: { elo_after: 1345, elo_delta: 25 },
            vs_humans: { elo_after: null, elo_delta: null },
            vs_bots: { elo_after: 1412, elo_delta: 2 },
          },
        },
      ],
    })
    mockApi.userApi.getRatingHistory.mockResolvedValue({
      series: {
        game: [
          { label: "Game 1", elo: 1290, delta: 16, played_at: "2026-03-21T12:00:00Z", game_number: 1 },
          { label: "Game 2", elo: 1412, delta: 2, played_at: "2026-03-25T12:00:00Z", game_number: 2 },
        ],
        date: [
          { label: "2026-03-21", elo: 1290, delta: 16, played_at: "2026-03-21T12:00:00Z", game_number: 1 },
          { label: "2026-03-25", elo: 1412, delta: 122, played_at: "2026-03-25T12:00:00Z", game_number: 2 },
        ],
      },
    })

    renderProfile()

    await screen.findByRole("heading", { name: "fil" })
    expect(screen.getByText("Member since 2026-01-01")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall rating" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results" })).toBeInTheDocument()
    expect(screen.getByText(/games played/i)).toBeInTheDocument()
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText("6 (60.0%)")).toBeInTheDocument()
    expect(screen.getByText("3 (30.0%)")).toBeInTheDocument()
    expect(screen.getByText("1 (10.0%)")).toBeInTheDocument()
    expect(screen.queryByText(/win rate/i)).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Overall Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Start 1290")).toBeInTheDocument()
    expect(screen.getByText("Latest 1412")).toBeInTheDocument()
    expect(screen.getAllByText("2026-03-25").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "Game number" }))
    expect(screen.getAllByText("Game 2").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    await waitFor(() => expect(mockApi.userApi.getRatingHistory).toHaveBeenCalledWith("fil", "vs_humans", 100))
    expect(screen.getByRole("heading", { name: "vs Humans rating" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Humans results" })).toBeInTheDocument()
    expect(screen.getByText("1 (100.0%)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "vs Bots" }))
    expect(screen.getByText("1410")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Bots rating" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "vs Bots Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Start 1290")).toBeInTheDocument()
    expect(screen.getByText("Latest 1412")).toBeInTheDocument()
    expect(screen.getByText("5 (55.6%)")).toBeInTheDocument()
    expect(screen.getByText(/win vs amy/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View all games" })).toHaveAttribute("href", "/user/fil/games")
  })

  it("shows_not_found_message_on_404", async () => {
    mockApi.userApi.getProfile.mockRejectedValueOnce({ status: 404, message: "nope" })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Profile not found.")
    })
  })

  it("shows_bot_note_with_external_blog_link", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "gptnano",
      role: "bot",
      owner_email: "bot-gpt-nano@kriegspiel.org",
      member_since: "2026-04-03T01:10:41Z",
      stats: {
        elo: 1200,
        elo_peak: 1200,
        ratings: {
          overall: { elo: 1200, peak: 1200 },
          vs_humans: { elo: 1200, peak: 1200 },
          vs_bots: { elo: 1200, peak: 1200 },
        },
      },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/gptnano")

    await screen.findByRole("heading", { name: "gptnano" })
    expect(screen.getByRole("heading", { name: "This user is bot" })).toBeInTheDocument()
    expect(screen.getByText(/On Kriegspiel\.org we allow bots\./i)).toBeInTheDocument()
    expect(screen.getByText(/You also can create your own bot – more bots, more fun\./i)).toBeInTheDocument()
    expect(screen.getByText(/Email address of this bot owner is bot-gpt-nano@kriegspiel\.org\./i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "blog post about bots ↗" })).toHaveAttribute("href", "https://kriegspiel.org/blog/bot-registration-flow")
    expect(screen.getByRole("link", { name: "blog post about bots ↗" })).toHaveAttribute("target", "_blank")
  })

  it("shows_the_default_error_message_when_profile_loading_fails_without_details", async () => {
    mockApi.userApi.getProfile.mockRejectedValueOnce({})
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to load profile.")
    })
  })

  it("falls_back_to_unknown_bot_values_and_recent_game_labels", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "haiku",
      is_bot: true,
      owner_email: null,
      member_since: null,
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-3",
          result: "draw",
          opponent: null,
        },
      ],
    })
    mockApi.userApi.getRatingHistory.mockRejectedValueOnce(new Error("history failed"))

    renderProfile("/user/haiku")

    await screen.findByRole("heading", { name: "haiku" })
    expect(screen.getByText("Member since Unknown")).toBeInTheDocument()
    expect(screen.getByText(/Email address of this bot owner is unknown\./i)).toBeInTheDocument()
    expect(screen.getByText(/draw vs unknown/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View all games" })).toHaveAttribute("href", "/user/haiku/games")
  })
})
