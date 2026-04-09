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
      bots: ["gptnano", "haiku"],
      rows: [
        { date: "2026-04-08", counts: { gptnano: 2, haiku: 4 } },
        { date: "2026-04-09", counts: { gptnano: 1, haiku: 0 } },
      ],
    })

    render(<MemoryRouter><BotsReportPage /></MemoryRouter>)

    expect(await screen.findByText("Bots report")).toBeInTheDocument()
    expect(await screen.findByText("2026-04-08")).toBeInTheDocument()
    expect(screen.getByText("gptnano")).toBeInTheDocument()
    expect(screen.getByText("haiku")).toBeInTheDocument()
  })
})
