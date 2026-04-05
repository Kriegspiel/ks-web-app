import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import ProfilePage from "../pages/Profile"

const mockApi = vi.hoisted(() => ({
  userApi: {
    getProfile: vi.fn(),
    getGameHistory: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.userApi.getProfile.mockReset()
  mockApi.userApi.getGameHistory.mockReset()
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
        games_played: 10,
        games_won: 6,
        games_lost: 3,
        games_drawn: 1,
        elo: 1345,
        elo_peak: 1401,
        ratings: {
          overall: { elo: 1345, peak: 1401 },
          vs_humans: { elo: 1290, peak: 1325 },
          vs_bots: { elo: 1410, peak: 1412 },
        },
      },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-1", result: "win", opponent: "amy", opponent_role: "user", played_at: "2026-03-21T12:00:00Z", elo_after: 1320, elo_delta: 16 },
        { game_id: "g-2", result: "loss", opponent: "bob", opponent_role: "bot", played_at: "2026-03-25T12:00:00Z", elo_after: 1345, elo_delta: 25 },
      ],
    })

    renderProfile()

    await screen.findByRole("heading", { name: "fil" })
    expect(screen.getByText("Member since 2026-01-01")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall rating" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results" })).toBeInTheDocument()
    expect(screen.getByText(/games played/i)).toBeInTheDocument()
    expect(screen.getAllByText("2").length).toBeGreaterThan(0)
    expect(screen.getAllByText("1 (50.0%)")).toHaveLength(2)
    expect(screen.getByText("0 (0.0%)")).toBeInTheDocument()
    expect(screen.queryByText(/win rate/i)).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Overall Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Start 1320")).toBeInTheDocument()
    expect(screen.getByText("Latest 1345")).toBeInTheDocument()
    expect(screen.getAllByText("2026-03-25").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "Game number" }))
    expect(screen.getAllByText("Game 2").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    expect(screen.getByText("1290")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Humans results" })).toBeInTheDocument()
    expect(screen.getByText("1 (100.0%)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "vs Bots" }))
    expect(screen.getByText("1410")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Bots rating" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "vs Bots Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("1 (100.0%)")).toBeInTheDocument()
    expect(screen.getByText(/win vs amy/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View all games" })).toHaveAttribute("href", "/user/fil/games")
  })

  it("shows_not_found_message_on_404", async () => {
    mockApi.userApi.getProfile.mockRejectedValueOnce({ status: 404, message: "nope" })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })

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

    renderProfile("/user/gptnano")

    await screen.findByRole("heading", { name: "gptnano" })
    expect(screen.getByRole("heading", { name: "This user is bot" })).toBeInTheDocument()
    expect(screen.getByText(/On Kriegspiel\.org we allow bots\./i)).toBeInTheDocument()
    expect(screen.getByText(/You also can create your own bot – more bots, more fun\./i)).toBeInTheDocument()
    expect(screen.getByText(/Email address of bot owner is bot-gpt-nano@kriegspiel\.org\./i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "blog post about bots ↗" })).toHaveAttribute("href", "https://kriegspiel.org/blog/bot-registration-flow")
    expect(screen.getByRole("link", { name: "blog post about bots ↗" })).toHaveAttribute("target", "_blank")
  })
})
