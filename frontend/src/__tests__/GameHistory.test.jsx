import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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
  it("uses_theme_surface_tokens_for_history_table_headers", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/GameHistory.css"), "utf8")

    expect(css).toContain("background: color-mix(in srgb, var(--surface-strong) 94%, var(--surface) 6%);")
    expect(css).toContain("color: var(--text);")
    expect(css).not.toContain("background: rgba(248, 250, 252, 0.92);")
    expect(css).not.toContain("border-bottom: 1px solid #e5eaf2;")
  })

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

  it("renders_human_opponents_with_the_berkeley_ruleset_and_disables_next_on_the_last_page", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-22",
          game_code: "HUMN22",
          rule_variant: "berkeley",
          opponent: "bob",
          opponent_role: "user",
          play_as: "black",
          result: "loss",
          reason: "timeout",
          turn_count: 12,
          played_at: "2026-01-03T00:00:00Z",
        },
      ],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    renderHistory()

    expect(await screen.findByRole("link", { name: "bob" })).toHaveAttribute("href", "/user/bob")
    expect(screen.getByText("Berkeley")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
  })

  it("falls_back_to_an_empty_history_when_the_games_payload_is_not_an_array", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: null,
      pagination: { page: 1, pages: 0, total: 0 },
    })

    renderHistory()

    expect(await screen.findByText("No games found on this page.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled()
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

  it("uses_visible_fallbacks_when_opponent_and_pagination_fields_are_nullish", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-nullish",
          rule_variant: "berkeley",
          opponent: null,
          opponent_role: null,
          play_as: "white",
          result: "draw",
          reason: "stalemate",
          turn_count: 3,
          played_at: "2026-01-04T00:00:00Z",
        },
      ],
      pagination: { page: null, pages: null, total: 1 },
    })

    renderHistory()

    expect(await screen.findByText("Berkeley")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /bot\)/i })).not.toBeInTheDocument()
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
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
