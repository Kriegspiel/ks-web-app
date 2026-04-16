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
      players: [{
        rank: 1,
        username: "amy",
        role: "user",
        is_bot: false,
        elo: 1500,
        ratings: { overall: { elo: 1500 }, vs_humans: { elo: 1520 }, vs_bots: { elo: 1470 } },
        games_played: 12,
        win_rate: 0.75,
      }],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("amy")
    expect(screen.getByRole("link", { name: "amy" })).toHaveAttribute("href", "/user/amy")
    expect(screen.getByText("Human")).toBeInTheDocument()
    expect(screen.getByText("1520")).toBeInTheDocument()
    expect(screen.getByText("1470")).toBeInTheDocument()
    expect(screen.getByText("75.0%")).toBeInTheDocument()
    expect(screen.getByText("Humans appear after 5 completed games. Listed bots can appear earlier.")).toBeInTheDocument()
  })

  it("shows_bot_type_for_bot_rows", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({
      players: [{ rank: 1, username: "randobot", role: "bot", is_bot: true, elo: 1400, ratings: { overall: { elo: 1400 }, vs_humans: { elo: 1300 }, vs_bots: { elo: 1450 } }, games_played: 40, win_rate: 0.5 }],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("randobot")
    expect(screen.getByText("Bot")).toBeInTheDocument()
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

  it("falls_back_to_empty_results_when_payload_fields_are_missing", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({})

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("No ranked players found.")
    expect(screen.getByText(/Page 1 of 0/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("shows_the_default_error_message_when_leaderboard_loading_fails_without_details", async () => {
    mockApi.userApi.getLeaderboard.mockRejectedValueOnce({})

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to load leaderboard.")
    })
  })
})
