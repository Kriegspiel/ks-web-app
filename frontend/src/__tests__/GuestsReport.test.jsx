import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import GuestsReportPage, { __guestsReportInternals as h } from "../pages/GuestsReport"

vi.mock("../services/api", () => ({
  techApi: {
    getGuestsReport: vi.fn(),
  },
}))

vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. 1.3.7 / v. 1.3.1</div>,
}))

const { techApi } = await import("../services/api")

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("GuestsReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("covers_guest_report_helper_fallbacks", () => {
    const guests = [
      { name: "Beta", username: "guest_beta", day_started: "", number_of_games: "bad" },
      { name: "Alpha", username: "guest_alpha", day_started: "2026-04-01", number_of_games: 2 },
      { name: "Gamma", username: "guest_gamma", day_started: "bad-date", number_of_games: 2 },
    ]
    const numberColumn = h.GUEST_COLUMNS.find((column) => column.key === "number_of_games")
    const dateColumn = h.GUEST_COLUMNS.find((column) => column.key === "day_started")
    const lastGameColumn = h.GUEST_COLUMNS.find((column) => column.key === "last_game")
    const nameColumn = h.GUEST_COLUMNS.find((column) => column.key === "name")
    const nonTimeoutColumn = h.GUEST_COLUMNS.find((column) => column.key === "non_timeout_games")
    const totalTimeColumn = h.GUEST_COLUMNS.find((column) => column.key === "total_time_played_seconds")
    const dayConfig = h.FILTER_CONFIGS.find((config) => config.key === "day_started")

    expect(h.filterLabel("__empty__")).toBe("—")
    expect(dayConfig.value({ day_started: null })).toBe("__empty__")
    expect(dayConfig.labelForValue("__empty__")).toBe("—")
    expect(dayConfig.labelForValue("not-a-date")).toBe("not-a-date")
    expect(h.dateSortValue("")).toBeNull()
    expect(h.dateSortValue("not-a-date")).toBeNull()
    expect(h.columnSortValue(numberColumn, guests[0])).toBeNull()
    expect(h.columnSortValue(dateColumn, guests[1])).toBe(Date.parse("2026-04-01"))
    expect(h.columnSortValue(lastGameColumn, { last_game: "2026-04-02T00:00:00Z" })).toBe(Date.parse("2026-04-02T00:00:00Z"))
    expect(h.columnSortValue(nameColumn, guests[0])).toBe("Beta")
    expect(h.columnSortValue(nonTimeoutColumn, { non_timeout_games: 3 })).toBe(3)
    expect(h.columnSortValue(totalTimeColumn, { total_time_played_seconds: 60 })).toBe(60)
    expect(h.compareGuestsByColumn(guests[0], { name: "Alpha", number_of_games: null }, numberColumn, "asc")).toBeGreaterThan(0)
    expect(h.compareGuestsByColumn(guests[1], guests[2], numberColumn, "desc")).toBeLessThan(0)
    expect(h.sortGuests(guests, null)).toBe(guests)
    expect(h.sortGuests(guests, { key: "unknown", direction: "asc" })).toBe(guests)
    expect(h.sortGuests(guests, { key: "number_of_games", direction: "desc" }).map((guest) => guest.name)).toEqual(["Alpha", "Gamma", "Beta"])

    const nameConfig = h.FILTER_CONFIGS.find((config) => config.key === "name")
    expect(h.buildFilterOptions(nameConfig, [], ["missing"])).toEqual([{ value: "missing", label: "missing" }])
    expect(h.selectedFilterCount({ name: ["a"], day_started: null })).toBe(1)
    expect(h.normalizeFilterValue("name", null)).toBe("")
    expect(h.parseSort(new URLSearchParams("sort=number_of_games&dir=sideways"))).toEqual({ key: "number_of_games", direction: "asc" })
    expect(h.parseSort(new URLSearchParams("sort=none"))).toBeNull()
    expect(h.filterGuests(guests, { name: ["Alpha"], day_started: [] })).toEqual([guests[1]])
  })

  it("renders_guest_report_table", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_099)
    techApi.getGuestsReport.mockResolvedValue({
      total: 2,
      available_guest_accounts: 39998,
      guests: [
        {
          name: "guest_mikhail_tal",
          username: "guest_mikhail_tal",
          day_started: "2026-04-01",
          last_game: "2026-04-04T13:00:00+00:00",
          number_of_games: 2,
          non_timeout_games: 1,
          total_time_played_seconds: 5_400,
        },
        {
          name: "guest_judit_polgar",
          username: "guest_judit_polgar",
          day_started: "2026-04-02",
          last_game: null,
          number_of_games: 0,
          non_timeout_games: 0,
          total_time_played_seconds: 0,
        },
        {
          name: "display-only guest",
          day_started: "not-a-date",
          last_game: "not-a-date",
          number_of_games: "not-a-number",
          non_timeout_games: Number.NaN,
          total_time_played_seconds: 45,
        },
        {
          day_started: "",
          last_game: "",
          total_time_played_seconds: 93_600,
        },
        {
          name: "hour guest",
          total_time_played_seconds: 7_260,
        },
        {
          name: "minute guest",
          total_time_played_seconds: 180,
        },
      ],
    })

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByText("Guests report")).toBeInTheDocument()
    expect(screen.getByText("Loaded in 99 ms.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "guest_mikhail_tal" })).toHaveAttribute("href", "/user/guest_mikhail_tal")
    expect(screen.getByRole("link", { name: "guest_judit_polgar" })).toHaveAttribute("href", "/user/guest_judit_polgar")
    expect(screen.getByText("2026-04-01")).toBeInTheDocument()
    expect(screen.getByText("2026-04-04 13:00:00 UTC")).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /Non-timeout endings/ })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /Total time played/ })).toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /guest_mikhail_tal/ })).getByText("1")).toBeInTheDocument()
    expect(within(screen.getByRole("row", { name: /guest_judit_polgar/ })).getAllByText("0")).toHaveLength(2)
    expect(screen.getByText("1h 30m")).toBeInTheDocument()
    expect(screen.getByText("0m")).toBeInTheDocument()
    expect(screen.getByText("display-only guest")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "display-only guest" })).not.toBeInTheDocument()
    expect(screen.getAllByText("not-a-date")).toHaveLength(2)
    expect(screen.getByText("45s")).toBeInTheDocument()
    expect(screen.getByText("1d 2h")).toBeInTheDocument()
    expect(screen.getByText("2h 1m")).toBeInTheDocument()
    expect(screen.getByText("3m")).toBeInTheDocument()
    expect(screen.getByText(/2 guests listed/)).toBeInTheDocument()
    expect(screen.getByText(/39,998 guest accounts still available/)).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it("filters_categorical_guest_columns_from_the_header_menu", async () => {
    techApi.getGuestsReport.mockResolvedValue({
      total: 2,
      available_guest_accounts: 39998,
      guests: [
        {
          name: "guest_mikhail_tal",
          username: "guest_mikhail_tal",
          day_started: "2026-04-01",
          number_of_games: 2,
          non_timeout_games: 1,
          total_time_played_seconds: 5_400,
        },
        {
          name: "guest_judit_polgar",
          username: "guest_judit_polgar",
          day_started: "2026-04-02",
          number_of_games: 0,
          non_timeout_games: 0,
          total_time_played_seconds: 0,
        },
      ],
    })

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByRole("link", { name: "guest_mikhail_tal" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Day started" }))
    fireEvent.click(await screen.findByRole("checkbox", { name: "2026-04-02" }))

    expect(screen.queryByRole("link", { name: "guest_mikhail_tal" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "guest_judit_polgar" })).toBeInTheDocument()
    expect(screen.getByText(/1 of 2 guests listed/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Day started 1" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }))

    expect(screen.getByRole("link", { name: "guest_mikhail_tal" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "guest_judit_polgar" })).toBeInTheDocument()
  })

  it("sorts_numerical_guest_columns_from_the_header_triangles", async () => {
    techApi.getGuestsReport.mockResolvedValue({
      total: 2,
      available_guest_accounts: 39998,
      guests: [
        {
          name: "guest_mikhail_tal",
          username: "guest_mikhail_tal",
          day_started: "2026-04-01",
          number_of_games: 2,
          non_timeout_games: 1,
          total_time_played_seconds: 5_400,
        },
        {
          name: "guest_judit_polgar",
          username: "guest_judit_polgar",
          day_started: "2026-04-02",
          number_of_games: 0,
          non_timeout_games: 0,
          total_time_played_seconds: 0,
        },
      ],
    })

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    await screen.findByRole("link", { name: "guest_mikhail_tal" })

    fireEvent.click(screen.getByRole("button", { name: "Sort Number of games" }))

    let rows = within(screen.getByRole("table").querySelector("tbody")).getAllByRole("row")
    expect(rows[0]).toHaveTextContent("guest_judit_polgar")
    expect(rows[1]).toHaveTextContent("guest_mikhail_tal")
    expect(screen.getByRole("columnheader", { name: /Number of games/ })).toHaveAttribute("aria-sort", "ascending")

    fireEvent.click(screen.getByRole("button", { name: "Sort Number of games" }))

    rows = within(screen.getByRole("table").querySelector("tbody")).getAllByRole("row")
    expect(rows[0]).toHaveTextContent("guest_mikhail_tal")
    expect(rows[1]).toHaveTextContent("guest_judit_polgar")
    expect(screen.getByRole("columnheader", { name: /Number of games/ })).toHaveAttribute("aria-sort", "descending")
  })

  it("shows_an_empty_row_when_filters_match_no_guests", async () => {
    techApi.getGuestsReport.mockResolvedValue({
      total: 1,
      available_guest_accounts: 39998,
      guests: [
        {
          name: "guest_mikhail_tal",
          username: "guest_mikhail_tal",
          day_started: "2026-04-01",
          number_of_games: 2,
        },
      ],
    })

    render(<MemoryRouter initialEntries={["/tech/guests?day_started=2026-04-02"]}><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByText("No guests match these filters.")).toBeInTheDocument()
    expect(screen.getByText(/0 of 1 guests listed/)).toBeInTheDocument()
  })

  it("renders_empty_state_for_missing_guest_array", async () => {
    techApi.getGuestsReport.mockResolvedValue({ guests: null, total: 0 })

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByText("No guests found.")).toBeInTheDocument()
  })

  it("falls_back_to_payload_length_and_zero_available_accounts", async () => {
    techApi.getGuestsReport.mockResolvedValue({
      guests: [
        { username: "guest_only" },
      ],
    })

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByText(/1 guests listed/)).toBeInTheDocument()
    expect(screen.getByText(/0 guest accounts still available/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "guest_only" })).toHaveAttribute("href", "/user/guest_only")
  })

  it("shows_the_default_error_message_when_the_report_request_has_no_details", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(2_000).mockReturnValueOnce(2_625)
    techApi.getGuestsReport.mockRejectedValue({})

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load guests report.")
    expect(screen.getByText("Request failed after 625 ms.")).toBeInTheDocument()

    nowSpy.mockRestore()
  })
})
