import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import AcquisitionReportPage from "../pages/AcquisitionReport"

vi.mock("../services/api", () => ({
  techApi: {
    getAcquisitionReport: vi.fn(),
  },
}))

vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. 1.3.75</div>,
}))

const { techApi } = await import("../services/api")

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("AcquisitionReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders_acquisition_rows_for_the_default_range", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_188)
    techApi.getAcquisitionReport.mockResolvedValue({
      rows: [
        {
          source: "reddit",
          medium: "post",
          campaign: "ruleset-default",
          visits: 12,
          sessions: 7,
          acquired_users: 3,
          games_created: 5,
          games_completed: 2,
        },
        {
          source: "",
          medium: null,
          campaign: "   ",
          visits: "not-a-number",
          sessions: 0,
          acquired_users: null,
          games_created: undefined,
          games_completed: Number.NaN,
        },
      ],
    })

    render(<AcquisitionReportPage />)

    expect(await screen.findByRole("heading", { name: "Acquisition report" })).toBeInTheDocument()
    expect(techApi.getAcquisitionReport).toHaveBeenCalledWith(30)
    expect(screen.getByText("Loaded in 188 ms.")).toBeInTheDocument()

    const table = screen.getByRole("table")
    const row = within(table).getByRole("row", { name: /reddit post ruleset-default/i })
    expect(row).toHaveTextContent("12")
    expect(row).toHaveTextContent("7")
    expect(row).toHaveTextContent("3")
    expect(row).toHaveTextContent("5")
    expect(row).toHaveTextContent("2")
    expect(screen.getAllByText("—")).toHaveLength(3)
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(5)

    nowSpy.mockRestore()
  })

  it("renders_zero_for_missing_completed_game_counts", async () => {
    techApi.getAcquisitionReport.mockResolvedValue({
      rows: [{ source: "direct" }],
    })

    render(<AcquisitionReportPage />)

    expect(await screen.findByText("direct")).toBeInTheDocument()
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(5)
  })

  it("reloads_when_the_range_changes", async () => {
    techApi.getAcquisitionReport
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ source: "reddit", visits: 1 }] })

    render(<AcquisitionReportPage />)

    expect(await screen.findByText("No acquisition rows found.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "90d" }))

    await waitFor(() => {
      expect(techApi.getAcquisitionReport).toHaveBeenLastCalledWith(90)
    })
    expect(await screen.findByText("reddit")).toBeInTheDocument()
  })

  it("renders_empty_state_for_missing_rows", async () => {
    techApi.getAcquisitionReport.mockResolvedValue({ rows: null })

    render(<AcquisitionReportPage />)

    expect(await screen.findByText("No acquisition rows found.")).toBeInTheDocument()
  })

  it("shows_the_default_error_message_when_the_report_request_has_no_details", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(2_000).mockReturnValueOnce(2_444)
    techApi.getAcquisitionReport.mockRejectedValue({})

    render(<AcquisitionReportPage />)

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load acquisition report.")
    expect(screen.getByText("Request failed after 444 ms.")).toBeInTheDocument()

    nowSpy.mockRestore()
  })
})
