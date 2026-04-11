import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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

describe("BotsReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders_report_table", async () => {
    techApi.getBotsReport.mockResolvedValue({
      timezone: "America/New_York",
      bots: [
        {
          username: "gptnano",
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
          username: "haiku",
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
    expect((await screen.findAllByText("2026-04-08")).length).toBe(2)
    expect(screen.getByRole("link", { name: "gptnano" })).toHaveAttribute("href", "/user/gptnano")
    expect(screen.getByRole("link", { name: "haiku" })).toHaveAttribute("href", "/user/haiku")
    expect(screen.getAllByText("Overall").length).toBeGreaterThan(0)
    expect(screen.getAllByText("vs. humans").length).toBeGreaterThan(0)
    expect(screen.getAllByText("vs. bots").length).toBeGreaterThan(0)
  })
})
