import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import BotMatrixReportPage from "../pages/BotMatrixReport"

vi.mock("../components/VersionStamp", () => ({
  default: () => <div>v. 1.3.83</div>,
}))

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe("BotMatrixReportPage", () => {
  it("renders_the_bot_matrix_with_full_linked_player_names_and_row_stats", async () => {
    const nowSpy = vi.spyOn(Date, "now")
    nowSpy.mockReturnValueOnce(1_000).mockReturnValueOnce(1_027)

    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    expect(await screen.findByRole("heading", { name: "Kriegsspiel bot matrix" })).toBeInTheDocument()
    expect(screen.getByText("Loaded in 27 ms.")).toBeInTheDocument()
    expect(screen.getByText("Built from 55 completed bot games and 110 row-perspective records.")).toBeInTheDocument()

    expect(document.querySelector(".bot-matrix-scroll .bot-matrix-table")).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "H" })).not.toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: "G25" })).not.toBeInTheDocument()

    const haikuLinks = screen.getAllByRole("link", { name: "LLM Haiku (bot)" })
    expect(haikuLinks[0]).toHaveAttribute("href", "/user/llm_haiku")
    expect(screen.getAllByRole("link", { name: "LLM GPT-Nano (bot)" })[0]).toHaveAttribute("href", "/user/llm_gptnano")
    expect(screen.getAllByRole("link", { name: "LLM Gemini 2.5 flashlight (bot)" })[0]).toHaveAttribute("href", "/user/llm_gemini25_lite")
    expect(screen.getAllByRole("link", { name: "LLM DeepSeek 4 flash (bot)" })[0]).toHaveAttribute("href", "/user/llm_deepseekv4_flash")
    expect(screen.getAllByRole("link", { name: "LLM Llama 3.5 8B (bot)" })[0]).toHaveAttribute("href", "/user/llm_llama31_8b")

    expect(screen.getAllByText("1-0-0").length).toBeGreaterThan(0)
    expect(screen.getAllByText("255 avg plies").length).toBeGreaterThan(0)
    expect(screen.getByText("this bot 1.21M / $0.351")).toBeInTheDocument()
    expect(screen.getByText("opponent 246k / $0.057")).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "LLM Haiku (bot) games" })[0]).toHaveAttribute("href", "/user/llm_haiku/games")
    expect(screen.getByText("7-3-0")).toBeInTheDocument()
    expect(screen.getByText("228 avg plies")).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it("renders_end_condition_counts_and_total_spend_rows", async () => {
    render(<MemoryRouter><BotMatrixReportPage /></MemoryRouter>)

    await screen.findByRole("heading", { name: "End conditions" })

    const endingTable = screen.getAllByRole("table")[1]
    expect(endingTable).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Timeout 30" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Resignation 15" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Checkmate 6" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Stalemate 2" })).toBeInTheDocument()
    expect(screen.getByRole("row", { name: "Insufficient material 2" })).toBeInTheDocument()

    const totalsTable = screen.getAllByRole("table")[2]
    const haikuTotal = within(totalsTable).getByRole("row", { name: /LLM Haiku \(bot\) 1055 9.11M \$2.688/ })
    expect(haikuTotal).toBeInTheDocument()
    const randomTotal = within(totalsTable).getByRole("row", { name: /Random bot 0 0 \$0/ })
    expect(randomTotal).toBeInTheDocument()
  })
})
