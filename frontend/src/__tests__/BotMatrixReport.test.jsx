import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import BotMatrixReportPage, { __botMatrixReportInternals as h } from "../pages/BotMatrixReport"

const mockApi = vi.hoisted(() => ({
  techApi: {
    getBotMatrixReport: vi.fn(),
  },
}))

vi.mock("../services/api", () => mockApi)

vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. 1.3.86</div>,
}))

const PLAYERS = [
  { username: "llm_haiku", name: "LLM Haiku (bot)" },
  { username: "llm_gptnano", name: "LLM GPT-Nano (bot)" },
  { username: "randobotany", name: "Random Any Bot" },
]

function summary(record, games, averagePlies, overrides = {}) {
  const [wins, draws, losses] = record.split("-").map((value) => Number(value))
  return {
    games,
    wins,
    draws,
    losses,
    record,
    average_plies: averagePlies,
    avg_plies: averagePlies,
    avg_calls: null,
    avg_tokens: null,
    avg_input_tokens: null,
    avg_cache_tokens: null,
    avg_output_tokens: null,
    avg_cost: null,
    player_tokens: null,
    player_input_tokens: null,
    player_cache_tokens: null,
    player_output_tokens: null,
    player_cost: null,
    opponent_tokens: null,
    opponent_input_tokens: null,
    opponent_cache_tokens: null,
    opponent_output_tokens: null,
    opponent_cost: null,
    win_share: games ? wins / games : null,
    draw_share: games ? draws / games : null,
    loss_share: games ? losses / games : null,
    ...overrides,
  }
}

const LIFETIME_REPORT = {
  period: "lifetime",
  generated_at: "2026-07-06T13:30:00Z",
  usage_start_date: "2026-07-04",
  players: PLAYERS,
  unique_game_count: 27350,
  row_record_count: 54700,
  matrix_rows: [
    {
      player: PLAYERS[0],
      cells: [
        { opponent: PLAYERS[0], summary: null },
        {
          opponent: PLAYERS[1],
          summary: summary("38-32-43", 113, 751.548, {
            player_tokens: 180,
            player_input_tokens: 130,
            player_cache_tokens: 20,
            player_output_tokens: 30,
            player_cost: 0.005,
            opponent_tokens: 75,
            opponent_input_tokens: 70,
            opponent_cache_tokens: 0,
            opponent_output_tokens: 5,
            opponent_cost: 0.02,
            usage_eligible_games: 113,
            usage_recorded_games: 1,
            opponent_usage_eligible_games: 113,
            opponent_usage_recorded_games: 1,
            usage_start_date: "2026-07-04",
          }),
        },
        { opponent: PLAYERS[2], summary: summary("3-2-1", 6, 92) },
      ],
      average: summary("41-34-44", 119, 718.2),
    },
    {
      player: PLAYERS[1],
      cells: [
        {
          opponent: PLAYERS[0],
          summary: summary("43-32-38", 113, 751.548, {
            opponent_tokens: 180,
            opponent_input_tokens: 130,
            opponent_cache_tokens: 20,
            opponent_output_tokens: 30,
            opponent_cost: 0.005,
            opponent_usage_eligible_games: 113,
            opponent_usage_recorded_games: 1,
            usage_start_date: "2026-07-04",
          }),
        },
        { opponent: PLAYERS[1], summary: null },
        { opponent: PLAYERS[2], summary: summary("8-2-0", 10, 128) },
      ],
      average: summary("51-34-38", 123, 701.1),
    },
    {
      player: PLAYERS[2],
      cells: [
        { opponent: PLAYERS[0], summary: summary("1-2-3", 6, 92) },
        { opponent: PLAYERS[1], summary: summary("0-2-8", 10, 128) },
        { opponent: PLAYERS[2], summary: null },
      ],
      average: summary("9000-6000-1032", 16032, 246.1),
    },
  ],
  end_condition_rows: [
    { condition: "timeout", label: "Timeout", games: 1227 },
    { condition: "checkmate", label: "Checkmate", games: 5684 },
    { condition: "insufficient", label: "Insufficient material", games: 11473 },
  ],
  total_rows: {
    all: [
      {
        player: PLAYERS[0],
        ...summary("101-6-6", 113, 751.548, {
          avg_calls: 2,
          avg_tokens: 180,
          avg_input_tokens: 130,
          avg_cache_tokens: 20,
          avg_output_tokens: 30,
          avg_cost: 0.005,
          usage_eligible_games: 113,
          usage_recorded_games: 1,
          usage_start_date: "2026-07-04",
          win_share: 0.894,
          draw_share: 0.053,
          loss_share: 0.053,
        }),
      },
      { player: PLAYERS[1], ...summary("100-50-50", 200, 700.4) },
      { player: PLAYERS[2], ...summary("9000-6000-1032", 16032, 246.1) },
    ],
    humans: [
      { player: PLAYERS[0], ...summary("2-1-2", 5, 12) },
      { player: PLAYERS[1], ...summary("0-0-0", 0, null) },
      { player: PLAYERS[2], ...summary("1-0-1", 2, 31) },
    ],
    bots: [
      { player: PLAYERS[0], ...summary("99-5-4", 108, 786.1) },
      { player: PLAYERS[1], ...summary("100-50-50", 200, 700.4) },
      { player: PLAYERS[2], ...summary("8999-6000-1031", 16030, 246.2) },
    ],
  },
}

const TODAY_REPORT = {
  ...LIFETIME_REPORT,
  period: "today",
  unique_game_count: 12,
  row_record_count: 24,
  end_condition_rows: [{ condition: "timeout", label: "Timeout", games: 12 }],
}

beforeEach(() => {
  mockApi.techApi.getBotMatrixReport.mockReset()
  mockApi.techApi.getBotMatrixReport.mockResolvedValue(LIFETIME_REPORT)
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("BotMatrixReportPage", () => {
  it("covers_bot_matrix_helper_fallbacks", () => {
    expect(h.numberOrNull("bad")).toBeNull()
    expect(h.formatTokens(null)).toBe("—")
    expect(h.formatTokens(0)).toBe("0")
    expect(h.formatTokens(950)).toBe("950")
    expect(h.formatTokens(1_250)).toBe("1.3k")
    expect(h.formatTokens(1_250_000)).toBe("1.25M")
    expect(h.periodRangeLabel("today", "2026-07-06T13:30:00Z")).toBe("2026-07-06 — 2026-07-06")
    expect(h.periodRangeLabel("lifetime", "2026-07-06T13:30:00Z")).toBe("Through 2026-07-06")
    expect(h.periodRangeLabel("week", "not-a-date")).toBe("")

    expect(h.reviewOutcomeOptions([{ condition: "custom_reason", label: "Custom reason" }])).toEqual(expect.arrayContaining([
      { value: "custom_reason", label: "Custom reason" },
    ]))
    expect(h.reviewOutcomeOptions([{ condition: "" }, { condition: "draw", label: "Duplicate draw" }]).some((option) => option.label === "Duplicate draw")).toBe(false)
    expect(h.outcomeRequestValues([], ["checkmate"])).toEqual(["__none__"])
    expect(h.outcomeRequestValues(["checkmate"], ["checkmate"])).toEqual([])

    expect(h.normalizePlayer(null)).toEqual({ username: "", name: "Unknown bot", code: "" })
    expect(h.normalizePlayer({ username: " bot_user ", displayName: " Display Bot " })).toEqual({ username: "bot_user", name: "Display Bot", code: "bot_user" })
    expect(h.normalizeSummary({ wins: 1, draws: 2, losses: 3, usageStartDate: "2026-07-05" })).toMatchObject({
      games: 0,
      record: "1-2-3",
      usageStartDate: "2026-07-05",
    })
    expect(h.normalizeTotalRow({ username: "fallback_bot", avgPlies: "bad" }, "2026-07-06")).toMatchObject({
      code: "fallback_bot",
      games: 0,
      avgPlies: null,
      usageStartDate: "2026-07-06",
    })

    const rows = [
      { playerName: "Beta", games: null },
      { playerName: "Alpha", games: 2 },
      { playerName: "Gamma", games: 2 },
    ]
    expect(h.sortTotalRows(rows, null).map((row) => row.playerName)).toEqual(["Beta", "Alpha", "Gamma"])
    expect(h.sortTotalRows(rows, { key: "player", direction: "asc" }).map((row) => row.playerName)).toEqual(["Alpha", "Beta", "Gamma"])
    expect(h.sortTotalRows(rows, { key: "unknown", direction: "asc" }).map((row) => row.playerName)).toEqual(["Alpha", "Gamma", "Beta"])
    expect(h.sortTotalRows([{ playerName: "Beta", games: null }, { playerName: "Alpha", games: null }], { key: "games", direction: "desc" }).map((row) => row.playerName)).toEqual(["Alpha", "Beta"])

    expect(h.sortValuesByReference(["z", "a"], ["a"])).toEqual(["a", "z"])
    expect(h.toggleSelectionValue(null, "a", ["a", "b"])).toEqual(["b"])
    expect(h.toggleSelectionValue(["a"], "b", ["a", "b"])).toEqual(["a", "b"])
    expect(h.botMatchupName({ name: "LLM GPT-Nano (bot)" })).toBe("GPT Nano")
    expect(h.botMatchupName({})).toBe("Unknown bot")
    expect(h.botMatchupName({ name: "   " })).toBe("Unknown bot")
  })

  it("renders_total_metric_helper_variants", () => {
    const { rerender } = render(<h.TotalMetric value={1234} kind="number" />)
    expect(screen.getByText("1,234")).toBeInTheDocument()

    rerender(<h.TotalMetric value={1234} kind="tokens" usageStartDate="2026-07-04" />)
    expect(screen.getByText("1.2k")).toHaveAttribute("title", expect.stringContaining("2026-07-04"))

    rerender(<h.TotalMetric value={{ input: 1000, cache: 0, output: null }} kind="tokenSplit" usageStartDate="2026-07-04" />)
    expect(screen.getByText("1k/0/—")).toHaveAttribute("title", expect.stringContaining("2026-07-04"))

    rerender(<h.TotalMetric value={0.125} kind="share" />)
    expect(screen.getByText("13%")).toBeInTheDocument()
  })

  it("renders_the_live_bot_matrix_with_full_linked_player_names_and_row_stats", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_042)

    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    expect(await screen.findByRole("heading", { name: "Bots' matrix" })).toBeInTheDocument()
    expect(mockApi.techApi.getBotMatrixReport).toHaveBeenCalledWith("week", [])
    expect(screen.getByText("Loaded in 42 ms.")).toBeInTheDocument()
    expect(screen.getByText("Built from 27,350 completed bot-vs-bot games and 54,700 row-perspective records.")).toBeInTheDocument()
    expect(screen.getByLabelText("Time period")).toHaveValue("week")
    expect(screen.getByRole("button", { name: "Review outcomes 8/8" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByText("2026-06-29 — 2026-07-06")).toBeInTheDocument()

    expect(document.querySelector(".bot-matrix-scroll .bot-matrix-table")).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "H" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Row bots 3/3" })).toHaveAttribute("aria-expanded", "false")
    expect(screen.getByRole("button", { name: "Column bots 3/3" })).toHaveAttribute("aria-expanded", "false")

    const haikuLinks = screen.getAllByRole("link", { name: "LLM Haiku (bot)" })
    expect(haikuLinks[0]).toHaveAttribute("href", "/user/llm_haiku")
    expect(screen.getAllByRole("link", { name: "LLM GPT-Nano (bot)" })[0]).toHaveAttribute("href", "/user/llm_gptnano")

    expect(screen.getByText("38-32-43")).toBeInTheDocument()
    expect(screen.getAllByText("Total games: 113").length).toBeGreaterThan(0)
    expect(screen.getAllByText("751.5 avg plies").length).toBeGreaterThan(0)
    expect(screen.getByText("Avg. tokens per game (in/cache/out): 130/20/30")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(screen.getByText("Avg. spend per game: $0.005000")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(screen.getByText("Opponent avg. tokens per game (in/cache/out): 130/20/30")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(screen.getByText("Opponent avg. spend per game: $0.005000")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(screen.queryByText(/opponent 75/)).not.toBeInTheDocument()
    expect(screen.getAllByText("Avg. tokens per game (in/cache/out): —/—/—").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "Haiku vs. GPT Nano games" })).toHaveAttribute(
      "href",
      "/user/llm_haiku/games?opponent=llm_gptnano",
    )
    expect(screen.getByRole("link", { name: "GPT Nano vs. Haiku games" })).toHaveAttribute(
      "href",
      "/user/llm_gptnano/games?opponent=llm_haiku",
    )

    nowSpy.mockRestore()
  })

  it("filters_the_report_and_game_history_links_by_selected_review_outcomes", async () => {
    mockApi.techApi.getBotMatrixReport
      .mockResolvedValueOnce(LIFETIME_REPORT)
      .mockResolvedValueOnce({
        ...LIFETIME_REPORT,
        unique_game_count: 7157,
        row_record_count: 14314,
        end_condition_rows: [
          { condition: "checkmate", label: "Checkmate", games: 5684 },
          { condition: "insufficient", label: "Insufficient material", games: 1473 },
        ],
      })

    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    await screen.findByRole("button", { name: "Review outcomes 8/8" })
    const matchupLink = await screen.findByRole("link", { name: "Haiku vs. GPT Nano games" })
    expect(matchupLink).toHaveAttribute("href", "/user/llm_haiku/games?opponent=llm_gptnano")

    fireEvent.click(screen.getByRole("button", { name: "Review outcomes 8/8" }))
    const outcomeMenu = await screen.findByRole("menu", { name: "Review outcomes" })
    expect(within(outcomeMenu).getByLabelText("Resignation")).toBeChecked()
    expect(within(outcomeMenu).getByLabelText("Timeout")).toBeChecked()

    fireEvent.click(within(outcomeMenu).getByRole("button", { name: "No resign/timeouts" }))

    await waitFor(() => expect(mockApi.techApi.getBotMatrixReport).toHaveBeenLastCalledWith(
      "week",
      ["checkmate", "stalemate", "insufficient", "too_many_reversible_moves", "draw", "unknown"],
    ))
    expect(await screen.findByText("Built from 7,157 completed bot-vs-bot games and 14,314 row-perspective records.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Review outcomes 6/8" })).toHaveAttribute("aria-expanded", "true")
    expect(within(outcomeMenu).getByLabelText("Resignation")).not.toBeChecked()
    expect(within(outcomeMenu).getByLabelText("Timeout")).not.toBeChecked()

    let params = new URLSearchParams(matchupLink.getAttribute("href").split("?")[1])
    expect(params.get("opponent")).toBe("llm_gptnano")
    expect(params.get("reason")).toBe("checkmate,stalemate,insufficient,too_many_reversible_moves,draw,unknown")

    const averageLink = screen.getByRole("link", { name: "LLM Haiku (bot) games" })
    params = new URLSearchParams(averageLink.getAttribute("href").split("?")[1])
    expect(params.get("reason")).toBe("checkmate,stalemate,insufficient,too_many_reversible_moves,draw,unknown")

    mockApi.techApi.getBotMatrixReport.mockResolvedValueOnce({
      ...LIFETIME_REPORT,
      unique_game_count: 5684,
      row_record_count: 11368,
      end_condition_rows: [{ condition: "checkmate", label: "Checkmate", games: 5684 }],
    })
    fireEvent.click(within(outcomeMenu).getByLabelText("Stalemate"))

    await waitFor(() => expect(mockApi.techApi.getBotMatrixReport).toHaveBeenLastCalledWith(
      "week",
      ["checkmate", "insufficient", "too_many_reversible_moves", "draw", "unknown"],
    ))

    const updatedMatchupLink = screen.getByRole("link", { name: "Haiku vs. GPT Nano games" })
    params = new URLSearchParams(updatedMatchupLink.getAttribute("href").split("?")[1])
    expect(params.get("opponent")).toBe("llm_gptnano")
    expect(params.get("reason")).toBe("checkmate,insufficient,too_many_reversible_moves,draw,unknown")
  })

  it("filters_the_outcome_matrix_by_selected_row_and_column_bots", async () => {
    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    await screen.findByRole("heading", { name: "Outcome matrix" })
    const matrixTable = screen.getAllByRole("table")[0]

    expect(within(matrixTable).getByRole("rowheader", { name: "Random Any Bot" })).toBeInTheDocument()
    expect(within(matrixTable).getByRole("columnheader", { name: "LLM GPT-Nano (bot)" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Row bots 3/3" }))
    const rowMenu = await screen.findByRole("menu", { name: "Row bots" })
    expect(within(rowMenu).getAllByRole("button").map((button) => button.textContent)).toEqual(["Clear all", "Select all"])
    expect(within(rowMenu).getByLabelText("LLM Haiku (bot)")).toBeChecked()
    expect(within(rowMenu).getByLabelText("LLM GPT-Nano (bot)")).toBeChecked()
    expect(within(rowMenu).getByLabelText("Random Any Bot")).toBeChecked()

    fireEvent.click(within(rowMenu).getByRole("button", { name: "Clear all" }))

    expect(within(matrixTable).getByText("No row bots selected.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Row bots 0/3" })).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(within(rowMenu).getByRole("button", { name: "Select all" }))

    expect(screen.getByRole("button", { name: "Row bots 3/3" })).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(within(rowMenu).getByLabelText("Random Any Bot"))

    expect(screen.getByRole("button", { name: "Row bots 2/3" })).toHaveAttribute("aria-expanded", "true")
    expect(within(matrixTable).queryByRole("rowheader", { name: "Random Any Bot" })).not.toBeInTheDocument()
    expect(within(matrixTable).getByRole("columnheader", { name: "Random Any Bot" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Column bots 3/3" }))
    const columnMenu = await screen.findByRole("menu", { name: "Column bots" })
    expect(screen.getByRole("button", { name: "Row bots 2/3" })).toHaveAttribute("aria-expanded", "false")
    expect(within(columnMenu).getByLabelText("LLM GPT-Nano (bot)")).toBeChecked()

    fireEvent.click(within(columnMenu).getByLabelText("LLM GPT-Nano (bot)"))

    expect(screen.getByRole("button", { name: "Column bots 2/3" })).toHaveAttribute("aria-expanded", "true")
    expect(matrixTable.style.getPropertyValue("--bot-matrix-visible-columns")).toBe("2")
    expect(within(matrixTable).queryByRole("columnheader", { name: "LLM GPT-Nano (bot)" })).not.toBeInTheDocument()
    expect(within(matrixTable).getByRole("rowheader", { name: "LLM GPT-Nano (bot)" })).toBeInTheDocument()
    expect(within(matrixTable).queryByRole("link", { name: "Haiku vs. GPT Nano games" })).not.toBeInTheDocument()

    fireEvent.click(within(columnMenu).getByRole("button", { name: "Select all" }))

    expect(screen.getByRole("button", { name: "Column bots 3/3" })).toHaveAttribute("aria-expanded", "true")
    expect(within(matrixTable).getByRole("columnheader", { name: "LLM GPT-Nano (bot)" })).toBeInTheDocument()
  })

  it("filters_the_report_by_selected_time_period_from_the_api", async () => {
    mockApi.techApi.getBotMatrixReport
      .mockResolvedValueOnce(LIFETIME_REPORT)
      .mockResolvedValueOnce(TODAY_REPORT)

    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    const periodSelect = await screen.findByLabelText("Time period")
    expect(periodSelect).toHaveValue("week")
    expect(await screen.findByText("2026-06-29 — 2026-07-06")).toBeInTheDocument()

    fireEvent.change(periodSelect, { target: { value: "today" } })

    await waitFor(() => expect(mockApi.techApi.getBotMatrixReport).toHaveBeenLastCalledWith("today", []))
    expect(periodSelect).toHaveValue("today")
    expect(screen.getByText("2026-07-06 — 2026-07-06")).toBeInTheDocument()
    expect(await screen.findByText("Built from 12 completed bot-vs-bot games and 24 row-perspective records.")).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Timeout 12" })).toBeInTheDocument()
  })

  it("renders_end_condition_counts_and_sortable_total_rows", async () => {
    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    await screen.findByRole("heading", { name: "End conditions" })

    const endingTable = screen.getAllByRole("table")[1]
    expect(endingTable).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Timeout 1,227" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Checkmate 5,684" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Insufficient material 11,473" })).toBeInTheDocument()

    const totalsTable = screen.getAllByRole("table")[2]
    expect(document.querySelector(".bot-matrix-totals-scroll .bot-matrix-totals-table__table")).toBe(totalsTable)
    expect(within(totalsTable).getByRole("columnheader", { name: /Total games/ })).toHaveAttribute("aria-sort", "descending")
    expect(within(totalsTable).getByRole("button", { name: "Sort Total games" })).toHaveClass("bot-matrix-sort-toggle--desc")
    expect(
      within(totalsTable).getByRole("button", { name: "Sort Avg plies" })
        .querySelectorAll(".bot-matrix-sort-toggle__triangle"),
    ).toHaveLength(2)
    const randomTotal = within(totalsTable).getByRole("row", { name: /Random Any Bot 16,032 246\.1 — —\/—\/— — 56% 37% 6\.4%/ })
    expect(randomTotal).toBeInTheDocument()
    expect(within(totalsTable).getByText("130/20/30")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(within(totalsTable).getByText("$0.005000")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )

    fireEvent.click(within(totalsTable).getByRole("button", { name: "Sort Win share" }))
    expect(within(totalsTable).getByRole("columnheader", { name: /Win share/ })).toHaveAttribute("aria-sort", "ascending")

    fireEvent.click(within(totalsTable).getByRole("button", { name: "Sort Win share" }))
    expect(within(totalsTable).getByRole("columnheader", { name: /Win share/ })).toHaveAttribute("aria-sort", "descending")
    const sortedRows = within(totalsTable).getAllByRole("row")
    expect(sortedRows[1]).toHaveTextContent(/LLM Haiku \(bot\)/)
  })

  it("filters_bot_totals_by_player_from_the_sticky_header_menu", async () => {
    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    await screen.findByRole("heading", { name: "Bot totals" })

    const totalsTable = screen.getAllByRole("table")[2]
    fireEvent.click(within(totalsTable).getByRole("button", { name: "Filter Player" }))

    const menu = await screen.findByRole("menu")
    expect(within(menu).getByLabelText("LLM Haiku (bot)")).toBeInTheDocument()

    fireEvent.click(within(menu).getByLabelText("LLM Haiku (bot)"))

    expect(within(totalsTable).getByRole("row", { name: /LLM Haiku \(bot\) 113 751\.5 2 130\/20\/30 \$0\.005000 89% 5\.3% 5\.3%/ })).toBeInTheDocument()
    expect(within(totalsTable).queryByRole("row", { name: /Random Any Bot/ })).not.toBeInTheDocument()

    fireEvent.click(within(menu).getByRole("button", { name: "Clear Player" }))
    expect(within(totalsTable).getByRole("row", { name: /Random Any Bot/ })).toBeInTheDocument()
  })

  it("filters_bot_totals_by_opponent_scope", async () => {
    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    await screen.findByRole("heading", { name: "Bot totals" })
    fireEvent.click(screen.getByRole("button", { name: "vs Humans" }))

    const totalsTable = screen.getAllByRole("table")[2]
    expect(screen.getByRole("button", { name: "vs Humans" })).toHaveAttribute("aria-pressed", "true")
    expect(within(totalsTable).getByRole("row", { name: /LLM Haiku \(bot\) 5 12 — —\/—\/— — 40% 20% 40%/ })).toBeInTheDocument()
  })
})
