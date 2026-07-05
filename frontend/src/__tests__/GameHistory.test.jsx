import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
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

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}

function renderHistory(path = "/user/fil/games") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        <Route path="/user/:username/games" element={<GameHistoryPage />} />
        <Route path="/game/:gameRef/review" element={<div>Review opened</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

function historyRows() {
  return screen.getAllByRole("row").slice(1)
}

describe("GameHistoryPage", () => {
  it("uses_theme_surface_tokens_for_history_table_headers", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/GameHistory.css"), "utf8")

    expect(css).toContain("background: color-mix(in srgb, var(--surface-strong) 94%, var(--surface) 6%);")
    expect(css).toContain("position: sticky;")
    expect(css).toContain("top: 0;")
    expect(css).toContain("max-height: min(72vh, 46rem);")
    expect(css).toContain(".history-sort-toggle--asc")
    expect(css).toContain(".history-sort-toggle--desc")
    expect(css).toContain(".history-page-size-control")
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

  it("sorts_by_date_and_time_descending_by_default", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-old", game_code: "OLD001", rule_variant: "berkeley", opponent: "old", opponent_role: "user", play_as: "white", result: "loss", reason: "timeout", turn_count: 8, played_at: "2026-01-01T00:00:00Z" },
        { game_id: "g-new", game_code: "NEW001", rule_variant: "cincinnati", opponent: "new", opponent_role: "user", play_as: "black", result: "win", reason: "checkmate", turn_count: 5, played_at: "2026-01-03T00:00:00Z" },
        { game_id: "g-mid", game_code: "MID001", rule_variant: "wild16", opponent: "middle", opponent_role: "bot", play_as: "white", result: "draw", reason: "stalemate", turn_count: 10, played_at: "2026-01-02T00:00:00Z" },
      ],
      pagination: { page: 1, pages: 1, total: 3 },
    })

    renderHistory()

    expect(await screen.findByRole("columnheader", { name: /Date and time/ })).toHaveAttribute("aria-sort", "descending")
    expect(historyRows().map((row) => within(row).getAllByRole("cell")[2].textContent)).toEqual(["new", "middle (bot)", "old"])
  })

  it("makes_each_history_column_sortable_from_the_header", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-low", game_code: "LOW001", rule_variant: "berkeley", opponent: "low", opponent_role: "user", play_as: "white", result: "loss", reason: "timeout", turn_count: 2, played_at: "2026-01-01T00:00:00Z" },
        { game_id: "g-high", game_code: "HIGH01", rule_variant: "wild16", opponent: "high", opponent_role: "bot", play_as: "black", result: "win", reason: "checkmate", turn_count: 9, played_at: "2026-01-02T00:00:00Z" },
      ],
      pagination: { page: 1, pages: 1, total: 2 },
    })

    renderHistory()

    for (const label of ["Rule set", "Color", "Opponent", "Result", "Reason", "Turns", "Date and time", "Review"]) {
      expect(await screen.findByRole("button", { name: `Sort ${label}` })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole("button", { name: "Sort Turns" }))
    expect(screen.getByRole("columnheader", { name: /Turns/ })).toHaveAttribute("aria-sort", "ascending")
    expect(historyRows().map((row) => within(row).getAllByRole("cell")[5].textContent)).toEqual(["2", "9"])
    expect(screen.getByTestId("location")).toHaveTextContent("sort=turns")
    expect(screen.getByTestId("location")).toHaveTextContent("dir=asc")

    fireEvent.click(screen.getByRole("button", { name: "Sort Turns" }))
    expect(screen.getByRole("columnheader", { name: /Turns/ })).toHaveAttribute("aria-sort", "descending")
    expect(historyRows().map((row) => within(row).getAllByRole("cell")[5].textContent)).toEqual(["9", "2"])
    expect(screen.getByTestId("location")).toHaveTextContent("dir=desc")

    fireEvent.click(screen.getByRole("button", { name: "Sort Turns" }))
    expect(screen.getByRole("columnheader", { name: /Turns/ })).toHaveAttribute("aria-sort", "none")
    expect(historyRows().map((row) => within(row).getAllByRole("cell")[5].textContent)).toEqual(["2", "9"])
    expect(screen.getByTestId("location")).toHaveTextContent("sort=none")
  })

  it("opens_header_filter_menus_and_groups_multi_select_opponents", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-human", game_code: "HUM001", rule_variant: "berkeley", opponent: "bob", opponent_role: "user", play_as: "white", result: "win", reason: "checkmate", turn_count: 6, played_at: "2026-01-04T00:00:00Z" },
        { game_id: "g-bot", game_code: "BOT001", rule_variant: "berkeley_any", opponent: "randobot", opponent_role: "bot", play_as: "black", result: "loss", reason: "timeout", turn_count: 8, played_at: "2026-01-03T00:00:00Z" },
        { game_id: "g-other", game_code: "OTH001", rule_variant: "wild16", opponent: "claire", opponent_role: "user", play_as: "white", result: "draw", reason: "stalemate", turn_count: 10, played_at: "2026-01-02T00:00:00Z" },
      ],
      pagination: { page: 1, pages: 1, total: 3 },
    })

    renderHistory()

    for (const label of ["Rule set", "Color", "Opponent", "Result", "Reason"]) {
      expect(await screen.findByRole("button", { name: label })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole("button", { name: "Opponent" }))
    const opponentMenu = await screen.findByRole("menu")
    await within(opponentMenu).findByText("Humans")
    expect(within(opponentMenu).getAllByText(/Humans|Bots/).map((node) => node.textContent)).toEqual(["Humans", "Bots"])

    fireEvent.click(within(opponentMenu).getByLabelText("bob"))
    expect(historyRows()).toHaveLength(1)
    expect(within(historyRows()[0]).getByRole("link", { name: "bob" })).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("opponent=human%3Abob")

    fireEvent.click(within(opponentMenu).getByLabelText("randobot (bot)"))
    expect(historyRows()).toHaveLength(2)
    expect(within(historyRows()[0]).getByRole("link", { name: "bob" })).toBeInTheDocument()
    expect(within(historyRows()[1]).getByRole("link", { name: "randobot (bot)" })).toBeInTheDocument()
    expect(screen.getByTestId("location")).toHaveTextContent("bot%3Arandobot")

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))
    expect(historyRows()).toHaveLength(3)
  })

  it("closes_an_open_filter_menu_when_clicking_elsewhere", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-human", game_code: "HUM001", rule_variant: "berkeley", opponent: "bob", opponent_role: "user", play_as: "white", result: "win", reason: "checkmate", turn_count: 6, played_at: "2026-01-04T00:00:00Z" },
      ],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    renderHistory()

    fireEvent.click(await screen.findByRole("button", { name: "Opponent" }))
    expect(await screen.findByRole("menu")).toBeInTheDocument()

    fireEvent.pointerDown(document.body)

    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument())
  })

  it("loads_sort_filters_page_and_page_size_from_the_url", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        { game_id: "g-bob", game_code: "BOB001", rule_variant: "berkeley", opponent: "bob", opponent_role: "user", play_as: "white", result: "win", reason: "checkmate", turn_count: 8, played_at: "2026-01-04T00:00:00Z" },
        { game_id: "g-claire", game_code: "CLA001", rule_variant: "wild16", opponent: "claire", opponent_role: "user", play_as: "black", result: "win", reason: "timeout", turn_count: 3, played_at: "2026-01-03T00:00:00Z" },
      ],
      pagination: { page: 2, pages: 4, total: 2000 },
    })

    renderHistory("/user/fil/games?page=2&per_page=500&sort=turns&dir=asc&result=win&opponent=human%3Abob")

    await waitFor(() => expect(mockApi.userApi.getGameHistory).toHaveBeenCalledWith("fil", 2, 500))
    expect(screen.getByLabelText("Games per page")).toHaveValue("500")
    expect(screen.getByRole("columnheader", { name: /Turns/ })).toHaveAttribute("aria-sort", "ascending")
    expect(historyRows()).toHaveLength(1)
    expect(within(historyRows()[0]).getByRole("link", { name: "bob" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Opponent 1" }))
    expect(await screen.findByLabelText("bob")).toBeChecked()
  })

  it("changes_the_backend_page_size_from_the_toolbar", async () => {
    mockApi.userApi.getGameHistory
      .mockResolvedValueOnce({ games: [{ game_id: "g-1", opponent: "amy" }], pagination: { page: 1, pages: 3, total: 241 } })
      .mockResolvedValueOnce({ games: [{ game_id: "g-2", opponent: "bob" }], pagination: { page: 1, pages: 1, total: 241 } })

    renderHistory("/user/fil/games?page=3")

    await screen.findByText("amy")
    fireEvent.change(screen.getByLabelText("Games per page"), { target: { value: "1000" } })

    await screen.findByText("bob")
    expect(mockApi.userApi.getGameHistory).toHaveBeenNthCalledWith(2, "fil", 1, 1000)
    expect(screen.getByTestId("location")).toHaveTextContent("per_page=1000")
    expect(screen.getByTestId("location")).not.toHaveTextContent("page=3")
  })

  it("opens_the_game_review_when_clicking_a_history_row", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [{ game_id: "g-click", game_code: "CLICK1", rule_variant: "berkeley", opponent: "amy", opponent_role: "user", play_as: "white", result: "win", reason: "checkmate", turn_count: 4, played_at: "2026-01-02T00:00:00Z" }],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    renderHistory()

    fireEvent.click((await screen.findAllByRole("row"))[1])

    expect(await screen.findByText("Review opened")).toBeInTheDocument()
  })

  it("formats_machine_result_reasons", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-reversible",
          game_code: "REV200",
          rule_variant: "berkeley_any",
          opponent: "amy",
          opponent_role: "bot",
          play_as: "white",
          result: "draw",
          reason: "too_many_reversible_moves",
          turn_count: 1000,
          played_at: "2026-06-02T14:45:16Z",
        },
      ],
      pagination: { page: 1, pages: 1, total: 1 },
    })

    renderHistory()

    expect(await screen.findByText("too many reversible moves")).toBeInTheDocument()
    expect(screen.queryByText("too_many_reversible_moves")).not.toBeInTheDocument()
  })

  it("renders_cincinnati_and_wild16_rule_labels", async () => {
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-cincinnati",
          game_code: "CINCY1",
          rule_variant: "cincinnati",
          opponent: "amy",
          opponent_role: "user",
          play_as: "white",
          result: "win",
          reason: "checkmate",
          turn_count: 14,
          played_at: "2026-01-05T00:00:00Z",
        },
        {
          game_id: "g-wild16",
          game_code: "WILD16",
          rule_variant: "wild16",
          opponent: "wildbot",
          opponent_role: "bot",
          play_as: "black",
          result: "loss",
          reason: "timeout",
          turn_count: 9,
          played_at: "2026-01-06T00:00:00Z",
        },
      ],
      pagination: { page: 1, pages: 1, total: 2 },
    })

    renderHistory()

    expect(await screen.findByText("Cincinnati")).toBeInTheDocument()
    expect(screen.getByText("Wild 16")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "wildbot (bot)" })).toHaveAttribute("href", "/user/wildbot")
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
