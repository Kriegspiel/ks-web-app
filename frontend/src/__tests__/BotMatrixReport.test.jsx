import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import BotMatrixReportPage from "../pages/BotMatrixReport"

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
  { username: "llm_gptnano", name: "LLM GPT-4.5 Nano (bot)" },
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
        { opponent: PLAYERS[0], summary: summary("43-32-38", 113, 751.548) },
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
  it("renders_the_live_bot_matrix_with_full_linked_player_names_and_row_stats", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_042)

    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    expect(await screen.findByRole("heading", { name: "Bots' matrix" })).toBeInTheDocument()
    expect(mockApi.techApi.getBotMatrixReport).toHaveBeenCalledWith("lifetime")
    expect(screen.getByText("Loaded in 42 ms.")).toBeInTheDocument()
    expect(screen.getByText("Built from 27,350 completed bot-vs-bot games and 54,700 row-perspective records.")).toBeInTheDocument()
    expect(screen.getByLabelText("Time period")).toHaveValue("lifetime")

    expect(document.querySelector(".bot-matrix-scroll .bot-matrix-table")).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "H" })).not.toBeInTheDocument()

    const haikuLinks = screen.getAllByRole("link", { name: "LLM Haiku (bot)" })
    expect(haikuLinks[0]).toHaveAttribute("href", "/user/llm_haiku")
    expect(screen.getAllByRole("link", { name: "LLM GPT-4.5 Nano (bot)" })[0]).toHaveAttribute("href", "/user/llm_gptnano")

    expect(screen.getByText("38-32-43")).toBeInTheDocument()
    expect(screen.getAllByText("751.5 avg plies").length).toBeGreaterThan(0)
    expect(screen.getByText("Avg. tokens (in/cache/out): 130/20/30")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(screen.getByText("Avg. spend: $0.005000")).toHaveAttribute(
      "title",
      "Average over games completed since 2026-07-04, when usage collection started.",
    )
    expect(screen.queryByText(/opponent 75/)).not.toBeInTheDocument()
    expect(screen.getAllByText("Avg. tokens (in/cache/out): —/—/—").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "Haiku versus GPT 4.5 Nano games" })).toHaveAttribute(
      "href",
      "/user/llm_haiku/games?opponent=llm_gptnano",
    )
    expect(screen.getByRole("link", { name: "GPT 4.5 Nano versus Haiku games" })).toHaveAttribute(
      "href",
      "/user/llm_gptnano/games?opponent=llm_haiku",
    )

    nowSpy.mockRestore()
  })

  it("filters_the_report_by_selected_time_period_from_the_api", async () => {
    mockApi.techApi.getBotMatrixReport
      .mockResolvedValueOnce(LIFETIME_REPORT)
      .mockResolvedValueOnce(TODAY_REPORT)

    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    const periodSelect = await screen.findByLabelText("Time period")
    expect(periodSelect).toHaveValue("lifetime")

    fireEvent.change(periodSelect, { target: { value: "today" } })

    await waitFor(() => expect(mockApi.techApi.getBotMatrixReport).toHaveBeenLastCalledWith("today"))
    expect(periodSelect).toHaveValue("today")
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
    expect(within(totalsTable).getByRole("columnheader", { name: /Total games DESC/ })).toHaveAttribute("aria-sort", "descending")
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

    fireEvent.click(within(totalsTable).getByRole("button", { name: "Sort by Win share desc" }))

    expect(within(totalsTable).getByRole("columnheader", { name: /Win share DESC/ })).toHaveAttribute("aria-sort", "descending")
    const sortedRows = within(totalsTable).getAllByRole("row")
    expect(sortedRows[1]).toHaveTextContent(/LLM Haiku \(bot\)/)
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
