import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import BotsReportPage from "../pages/BotsReport"

vi.mock("../services/api", () => ({
  techApi: {
    getBotsReport: vi.fn(),
  },
}))

vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. 1.2.48 / v. 1.2.14</div>,
}))

const { techApi } = await import("../services/api")

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("BotsReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders_report_table", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_418)
    techApi.getBotsReport.mockResolvedValue({
      timezone: "America/New_York",
      bots: [
        {
          username: "llm_gptnano",
          rows: [
            {
              date: "2026-04-08",
              stats: {
                overall: { total_games: 2, win_rate: 0.5 },
                vs_humans: { total_games: 0, win_rate: 0.0 },
                vs_bots: { total_games: 2, win_rate: 0.5 },
              },
            },
          ],
        },
        {
          username: "llm_haiku",
          rows: [
            {
              date: "2026-04-08",
              stats: {
                overall: { total_games: 4, win_rate: 0.25 },
                vs_humans: { total_games: 0, win_rate: 0.0 },
                vs_bots: { total_games: 4, win_rate: 0.25 },
              },
            },
          ],
        },
      ],
    })

    render(<MemoryRouter><BotsReportPage /></MemoryRouter>)

    expect(await screen.findByText("Bots report")).toBeInTheDocument()
    expect(screen.getByText("Loaded in 418 ms.")).toBeInTheDocument()
    expect((await screen.findAllByText("2026-04-08")).length).toBe(2)
    expect(screen.getByRole("link", { name: "llm_gptnano" })).toHaveAttribute("href", "/user/llm_gptnano")
    expect(screen.getByRole("link", { name: "llm_haiku" })).toHaveAttribute("href", "/user/llm_haiku")
    expect(screen.getAllByText("Overall").length).toBeGreaterThan(0)
    expect(screen.getAllByText("vs. humans").length).toBeGreaterThan(0)
    expect(screen.getAllByText("vs. bots").length).toBeGreaterThan(0)

    nowSpy.mockRestore()
  })

  it("falls_back_to_the_default_timezone_and_zeroed_row_stats", async () => {
    techApi.getBotsReport.mockResolvedValue({
      timezone: "",
      bots: [
        {
          username: "llm_gptnano",
          rows: null,
        },
        {
          username: "llm_haiku",
          rows: [
            {
              date: "2026-04-09",
              stats: null,
            },
          ],
        },
      ],
    })

    render(<MemoryRouter><BotsReportPage /></MemoryRouter>)

    expect(await screen.findByRole("link", { name: "llm_gptnano" })).toHaveAttribute("href", "/user/llm_gptnano")
    expect(screen.getByRole("link", { name: "llm_haiku" })).toHaveAttribute("href", "/user/llm_haiku")
    expect(screen.getAllByText(/America\/New_York/).length).toBeGreaterThan(0)
    expect(screen.getByText("2026-04-09")).toBeInTheDocument()
    expect(screen.getAllByText("0")).not.toHaveLength(0)
    expect(screen.getAllByText("0.0%")).toHaveLength(3)
  })

  it("renders_no_bot_sections_for_missing_bot_arrays", async () => {
    techApi.getBotsReport.mockResolvedValue({
      bots: null,
      timezone: "UTC",
    })

    render(<MemoryRouter><BotsReportPage /></MemoryRouter>)

    expect(await screen.findByText(/Completed-game stats for the last 10 days in UTC/)).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
  })

  it("shows_the_default_error_message_when_the_report_request_has_no_details", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(2_000).mockReturnValueOnce(3_250)
    techApi.getBotsReport.mockRejectedValue({})

    render(<MemoryRouter><BotsReportPage /></MemoryRouter>)

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load bots report.")
    expect(screen.getByText("Request failed after 1.3 s.")).toBeInTheDocument()

    nowSpy.mockRestore()
  })
})
