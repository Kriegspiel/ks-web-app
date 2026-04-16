import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import GameHistoryPage from "../pages/GameHistory"

const mockApi = vi.hoisted(() => ({
  userApi: {
    getGameHistory: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)
vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. test-frontend / v. test-backend</div>,
}))

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.userApi.getGameHistory.mockReset()
})

function renderHistory(path = "/user/fil/games") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/user/:username/games" element={<GameHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("GameHistoryPage", () => {
  it("renders_rows_and_review_links", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [{ game_id: "g-20", game_code: "A7K2M9", rule_variant: "berkeley_any", opponent: "amy", opponent_role: "bot", play_as: "white", result: "win", reason: "checkmate", move_count: 22, turn_count: 10, played_at: "2026-01-02T00:00:00Z" }],
      pagination: { page: 1, pages: 2, total: 121 },
    })

    renderHistory()

    expect(await screen.findByRole("link", { name: "Back to user" })).toHaveAttribute("href", "/user/fil")
    expect(await screen.findByRole("link", { name: "amy (bot)" })).toHaveAttribute("href", "/user/amy")
    expect(screen.getByText("Berkeley + Any")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/game/A7K2M9/review")
    expect(screen.getByText("10")).toBeInTheDocument()
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument()
    expect(screen.getByText("v. test-frontend / v. test-backend")).toBeInTheDocument()
  })

  it("handles_prev_next_pagination", async () => {
    mockApi.userApi.getGameHistory
      .mockResolvedValueOnce({ games: [{ game_id: "g-1", opponent: "amy" }], pagination: { page: 1, pages: 3, total: 241 } })
      .mockResolvedValueOnce({ games: [{ game_id: "g-2", opponent: "bob" }], pagination: { page: 2, pages: 3, total: 241 } })
      .mockResolvedValueOnce({ games: [{ game_id: "g-1", opponent: "amy" }], pagination: { page: 1, pages: 3, total: 241 } })

    renderHistory()

    await screen.findByText("amy")
    fireEvent.click(screen.getByRole("button", { name: "Next" }))

    await screen.findByText("bob")
    expect(mockApi.userApi.getGameHistory).toHaveBeenNthCalledWith(2, "fil", 2, 100)

    fireEvent.click(screen.getByRole("button", { name: "Prev" }))
    await waitFor(() => expect(mockApi.userApi.getGameHistory).toHaveBeenNthCalledWith(3, "fil", 1, 100))
  })

  it("falls_back_to_full_turns_when_only_move_count_is_present", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [{ game_id: "g-21", move_count: 7 }],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    renderHistory()

    expect(await screen.findByText("4")).toBeInTheDocument()
  })



  it("shows_user_not_found_error", async () => {
    mockApi.userApi.getGameHistory.mockRejectedValueOnce({ status: 404, message: "missing" })
    renderHistory()
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("User not found.")
    })
  })

  it("shows_empty_state_for_out_of_range_page", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [], pagination: { page: 5, pages: 4, total: 301 } })
    renderHistory()
    await screen.findByText("No games found on this page.")
  })

  it("falls_back_for_unknown_rules_missing_opponents_and_missing_pagination", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-unknown",
          rule_variant: "mystery",
          opponent: "",
          play_as: "black",
          result: "draw",
          reason: null,
          move_count: "oops",
          played_at: null,
        },
      ],
      pagination: null,
    })

    renderHistory()

    expect((await screen.findAllByText("—")).length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/game/g-unknown/review")
    expect(screen.getByText(/Page 1 of 0/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled()
  })

  it("shows_the_default_error_message_when_history_loading_fails_without_details", async () => {
    mockApi.userApi.getGameHistory.mockRejectedValueOnce({})

    renderHistory()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to load game history.")
    })
  })
})
