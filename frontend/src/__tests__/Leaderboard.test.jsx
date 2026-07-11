import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { MemoryRouter } from "react-router-dom"
import LeaderboardPage from "../pages/Leaderboard"

const mockApi = vi.hoisted(() => ({
  userApi: {
    getLeaderboard: vi.fn(),
    getLeaderboardFilterOptions: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.userApi.getLeaderboard.mockReset()
  mockApi.userApi.getLeaderboardFilterOptions.mockReset()
})

describe("LeaderboardPage", () => {
  it("lets_long_leaderboards_use_page_scroll_with_a_sticky_header", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/Leaderboard.css"), "utf8")

    expect(css).toContain(".leaderboard-table-wrap--interactive {\n  overflow: visible;\n  max-height: none;\n}")
    expect(css).toContain(".leaderboard-table--interactive {\n  min-width: 64rem;\n  border-collapse: separate;\n  border-spacing: 0;\n  overflow: visible;\n}")
    expect(css).toContain(".leaderboard-table--interactive thead th {\n  position: sticky;\n  top: 4.1rem;")
    expect(css).toContain("@media (max-width: 720px) {\n  .leaderboard-table--interactive thead th {\n    top: 7.2rem;")
    expect(css).not.toContain(".leaderboard-table-wrap--interactive {\n  overflow-y: auto;")
    expect(css).not.toContain(".leaderboard-table-wrap--interactive {\n  overflow-x: auto;")
    expect(css).not.toContain("max-height: min(72vh, 46rem);")
  })

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
    expect(mockApi.userApi.getLeaderboard).toHaveBeenCalledWith(1, 20, {
      sort: { key: "rank", direction: "asc" },
      filters: { username: [], type: [] },
      includeFilterOptions: false,
    })
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
    await waitFor(() => expect(mockApi.userApi.getLeaderboard).toHaveBeenNthCalledWith(2, 2, 20, {
      sort: { key: "rank", direction: "asc" },
      filters: { username: [], type: [] },
      includeFilterOptions: false,
    }))
  })

  it("falls_back_to_empty_results_when_payload_fields_are_missing", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({})

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("No ranked players found.")
    expect(screen.getByText(/Page 1 of 0/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("falls_back_to_current_page_labels_when_pagination_counts_are_nullish", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({
      players: [{ rank: 1, username: "amy", games_played: 1, win_rate: 0 }],
      pagination: { page: null, pages: null, total: 1 },
    })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("amy")
    expect(screen.getByText(/Page 1 of 0/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled()
  })

  it("shows_the_default_error_message_when_leaderboard_loading_fails_without_details", async () => {
    mockApi.userApi.getLeaderboard.mockRejectedValueOnce({})

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to load leaderboard.")
    })
  })

  it("sorts_from_column_headers", async () => {
    mockApi.userApi.getLeaderboard
      .mockResolvedValueOnce({ players: [{ rank: 1, username: "amy" }], pagination: { page: 1, pages: 1, total: 1 } })
      .mockResolvedValueOnce({ players: [{ rank: 2, username: "bob" }], pagination: { page: 1, pages: 1, total: 1 } })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("amy")
    fireEvent.click(screen.getByRole("button", { name: "Sort Games" }))
    await screen.findByText("bob")

    expect(mockApi.userApi.getLeaderboard).toHaveBeenNthCalledWith(2, 1, 20, {
      sort: { key: "games", direction: "asc" },
      filters: { username: [], type: [] },
      includeFilterOptions: false,
    })
    expect(screen.getByRole("columnheader", { name: /Games/ })).toHaveAttribute("aria-sort", "ascending")
  })

  it("filters_by_type_from_the_column_menu", async () => {
    mockApi.userApi.getLeaderboard
      .mockResolvedValueOnce({ players: [{ rank: 1, username: "amy" }], pagination: { page: 1, pages: 1, total: 2 } })
      .mockResolvedValueOnce({ players: [{ rank: 2, username: "randobot", role: "bot", is_bot: true }], pagination: { page: 1, pages: 1, total: 1 } })
    mockApi.userApi.getLeaderboardFilterOptions.mockResolvedValueOnce({
      filter_options: {
        username: [
          { value: "amy", label: "amy", group: "Humans", count: 1 },
          { value: "randobot", label: "randobot", group: "Bots", count: 1 },
        ],
        type: [
          { value: "human", label: "Human", group: "", count: 1 },
          { value: "bot", label: "Bot", group: "", count: 1 },
        ],
      },
    })

    render(<MemoryRouter><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("amy")
    fireEvent.click(screen.getByRole("button", { name: "Type" }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "Bot" }))
    await screen.findByText("randobot")

    expect(mockApi.userApi.getLeaderboardFilterOptions).toHaveBeenCalledTimes(1)
    expect(mockApi.userApi.getLeaderboard).toHaveBeenNthCalledWith(2, 1, 20, {
      sort: { key: "rank", direction: "asc" },
      filters: { username: [], type: ["bot"] },
      includeFilterOptions: false,
    })
    expect(screen.getByRole("button", { name: "Type 1" })).toHaveTextContent("1")
  })

  it("shows_filter_empty_state_when_active_filters_match_no_players", async () => {
    mockApi.userApi.getLeaderboard.mockResolvedValueOnce({
      players: [],
      pagination: { page: 1, pages: 0, total: 0 },
    })

    render(<MemoryRouter initialEntries={["/leaderboard?type=bot"]}><LeaderboardPage /></MemoryRouter>)

    await screen.findByText("No players match these filters.")
    expect(screen.getByRole("button", { name: "Clear filters" })).not.toBeDisabled()
    expect(mockApi.userApi.getLeaderboard).toHaveBeenCalledWith(1, 20, {
      sort: { key: "rank", direction: "asc" },
      filters: { username: [], type: ["bot"] },
      includeFilterOptions: false,
    })
  })
})
