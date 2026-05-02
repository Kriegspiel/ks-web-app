import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import GuestsReportPage from "../pages/GuestsReport"

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
        },
        {
          name: "guest_judit_polgar",
          username: "guest_judit_polgar",
          day_started: "2026-04-02",
          last_game: null,
          number_of_games: 0,
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
    expect(screen.getByText(/2 guests listed/)).toBeInTheDocument()
    expect(screen.getByText(/39,998 guest accounts still available/)).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it("renders_empty_state_for_missing_guest_array", async () => {
    techApi.getGuestsReport.mockResolvedValue({ guests: null, total: 0 })

    render(<MemoryRouter><GuestsReportPage /></MemoryRouter>)

    expect(await screen.findByText("No guests found.")).toBeInTheDocument()
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
