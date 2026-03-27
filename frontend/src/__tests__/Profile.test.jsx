import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
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
      stats: { games_played: 10, games_won: 6, games_lost: 3, games_drawn: 1, elo: 1345, elo_peak: 1401 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-1", result: "win", opponent: "amy" },
        { game_id: "g-2", result: "loss", opponent: "bob" },
      ],
    })

    renderProfile()

    await screen.findByRole("heading", { name: "fil" })
    expect(screen.getByText(/games played/i)).toBeInTheDocument()
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
})
