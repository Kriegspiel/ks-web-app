import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import LeaderboardPage from "../pages/Leaderboard"

const mockApi = vi.hoisted(() => ({
  userApi: {
    getLeaderboard: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.userApi.getLeaderboard.mockReset()
})

describe("LeaderboardPage", () => {
  it("renders_ranked_rows_and_profile_links", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({
      players: [{ rank: 1, username: "amy", elo: 1500, games_played: 12, win_rate: 0.75 }],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("amy")
    expect(screen.getByRole("link", { name: "amy" })).toHaveAttribute("href", "/user/amy")
    expect(screen.getByText("75.0%")).toBeInTheDocument()
  })

  it("shows_error_when_leaderboard_fails", async () => {
    mockApi.userApi.getLeaderboard.mockRejectedValueOnce({ message: "Boom" })
    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Boom")
    })
  })

  it("shows_empty_state_and_disables_next_when_no_players", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({ players: [], pagination: { page: 1, pages: 0, total: 0 } })
    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)
    await screen.findByText("No ranked players found.")
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("paginates_and_requests_next_page", async () => {
    mockApi.userApi.getLeaderboard
      .mockResolvedValueOnce({ players: [{ rank: 1, username: "amy" }], pagination: { page: 1, pages: 2, total: 40 } })
      .mockResolvedValueOnce({ players: [{ rank: 21, username: "bob" }], pagination: { page: 2, pages: 2, total: 40 } })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("amy")
    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    await screen.findByText("bob")
    await waitFor(() => expect(mockApi.userApi.getLeaderboard).toHaveBeenNthCalledWith(2, 2, 20))
  })
})
