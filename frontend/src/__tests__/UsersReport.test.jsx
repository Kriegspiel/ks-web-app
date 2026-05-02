import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import UsersReportPage from "../pages/UsersReport"

vi.mock("../services/api", () => ({
  techApi: {
    getUsersReport: vi.fn(),
  },
}))

vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. 1.3.10 / v. 1.3.6</div>,
}))

const { techApi } = await import("../services/api")

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("UsersReportPage", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("renders_activity_sections_and_last_user_games", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_246)
    techApi.getUsersReport.mockResolvedValue({
      timezone: "America/New_York",
      sections: [
        {
          key: "dau",
          title: "DAU",
          rows: [
            { label: "2026-04-30", active_users: 1, active_bots: 2, total_games: 4 },
            { label: "2026-05-01", active_users: 2, active_bots: 1, total_games: 3 },
          ],
        },
        {
          key: "wau",
          title: "WAU",
          rows: [{ label: "2026-04-27", active_users: 3, active_bots: 2, total_games: 6 }],
        },
        {
          key: "mau",
          title: "MAU",
          rows: [{ label: "2026-05", active_users: 4, active_bots: 2, total_games: 8 }],
        },
      ],
      last_games: [
        {
          game_id: "gid-1",
          game_code: "USER01",
          rule_variant: "crazykrieg",
          white: { username: "fil", role: "user" },
          black: { username: "gptnano", role: "bot" },
          result: { winner: "white", reason: "checkmate" },
          played_at: "2026-05-01T12:00:00+00:00",
          review_path: "/game/USER01/review",
        },
      ],
    })

    render(<MemoryRouter><UsersReportPage /></MemoryRouter>)

    expect(await screen.findByRole("heading", { name: "Users report" })).toBeInTheDocument()
    expect(screen.getByText("Loaded in 246 ms.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "DAU" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "WAU" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "MAU" })).toBeInTheDocument()
    expect(screen.getAllByText("Active users").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Total games").length).toBeGreaterThan(0)

    const gamesSection = screen.getByRole("heading", { name: "Last 100 games by users" }).closest("section")
    expect(within(gamesSection).getByRole("link", { name: "USER01" })).toHaveAttribute("href", "/game/USER01/review")
    expect(within(gamesSection).getByText("CrazyKrieg")).toBeInTheDocument()
    expect(within(gamesSection).getByRole("link", { name: "fil" })).toHaveAttribute("href", "/user/fil")
    expect(within(gamesSection).getByRole("link", { name: "gptnano (bot)" })).toHaveAttribute("href", "/user/gptnano")
    expect(within(gamesSection).getByText("white, checkmate")).toBeInTheDocument()
    expect(within(gamesSection).getByText("2026-05-01 12:00:00 UTC")).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it("renders_empty_state_for_missing_arrays", async () => {
    techApi.getUsersReport.mockResolvedValue({ sections: null, last_games: null })

    render(<MemoryRouter><UsersReportPage /></MemoryRouter>)

    expect(await screen.findByText("No user games found.")).toBeInTheDocument()
  })

  it("shows_the_default_error_message_when_the_report_request_has_no_details", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(2_000).mockReturnValueOnce(2_333)
    techApi.getUsersReport.mockRejectedValue({})

    render(<MemoryRouter><UsersReportPage /></MemoryRouter>)

    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load users report.")
    expect(screen.getByText("Request failed after 333 ms.")).toBeInTheDocument()

    nowSpy.mockRestore()
  })
})
