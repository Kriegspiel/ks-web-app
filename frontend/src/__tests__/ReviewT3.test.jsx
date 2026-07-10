import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ReviewT3Page from "../pages/ReviewT3"

const mockApi = vi.hoisted(() => ({
  getGameT3Review: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useParams: () => ({ gameCode: "T3A9B7" }),
  }
})

vi.mock("../services/api", () => mockApi)

const t3Review = {
  game: {
    game_code: "T3A9B7",
    rule_variant: "wild16",
    white: { username: "fil", role: "user", connected: true },
    black: { username: "llm_gptnano", role: "bot", connected: true },
  },
  transcript: {
    game_id: "gid1",
    rule_variant: "wild16",
    viewer_color: null,
    moves: [],
  },
  analysis: {
    meta: {
      analysis_version: "darkboard-review-t3-v1",
      analyzer: "bot-darkboard-mcts public-outcome scorer",
      ruleset: "wild16",
      supported: true,
      generated_at: "2026-07-10T00:00:00Z",
      model: "gpt-5.5",
      openai_status: "generated",
      openai_error: null,
    },
    summary: {
      analyzed_moves: 1,
      best_moves: 1,
      inaccuracies: 0,
      mistakes: 0,
      blunders: 0,
    },
    moves: [
      {
        ply: 1,
        color: "white",
        uci: "e2e4",
        move_done: true,
        label: "good",
        confidence: "high",
        score: 44.5,
        best_uci: "e2e4",
        best_score: 44.5,
        move_delta: 0,
        side_to_move_label: "position looks unclear",
        explanation: "White's e2e4 looks good. It improves development without creating a large public risk.",
        deterministic_explanation: "White's e2e4 looks good.",
        top_alternatives: [{ uci: "e2e4", score: 44.5 }],
        reasons: [
          {
            name: "development",
            value: 32,
            direction: "positive",
            description: "It improves development or piece activity from the visible board.",
          },
        ],
        components: {
          development: 32,
          legality_penalty: -2,
        },
        probabilities: {
          legal_probability: 0.96,
          capture_probability: 0.04,
          check_probability: 0.01,
          exposed_piece_capture_probability: 0.11,
        },
        mcts_iterations: 96,
      },
    ],
  },
}

beforeEach(() => {
  mockApi.getGameT3Review.mockReset()
  mockApi.getGameT3Review.mockResolvedValue(t3Review)
})

afterEach(() => {
  cleanup()
})

function renderPage() {
  return render(
    <MemoryRouter>
      <ReviewT3Page />
    </MemoryRouter>,
  )
}

describe("ReviewT3Page", () => {
  it("renders_t3_summary_move_metrics_and_explanation", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "T3 review" })).toBeInTheDocument()
    expect(mockApi.getGameT3Review).toHaveBeenCalledWith("T3A9B7")
    expect(screen.getByText("fil vs llm_gptnano · Wild 16")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Replay" })).toHaveAttribute("href", "/game/T3A9B7/review")

    const summary = screen.getByLabelText("T3 analysis summary")
    expect(within(summary).getByText("Analyzed")).toBeInTheDocument()
    expect(within(summary).getAllByText("1").length).toBeGreaterThan(0)

    expect(screen.getByText("White e2e4")).toBeInTheDocument()
    expect(screen.getByText("good")).toBeInTheDocument()
    expect(screen.getByText("White's e2e4 looks good. It improves development without creating a large public risk.")).toBeInTheDocument()
    expect(screen.getByText("Legal")).toBeInTheDocument()
    expect(screen.getByText("96%")).toBeInTheDocument()
    expect(screen.getByText("Development")).toBeInTheDocument()
  })

  it("renders_api_errors", async () => {
    mockApi.getGameT3Review.mockRejectedValue({ message: "No analysis" })
    renderPage()

    expect(await screen.findByText("No analysis")).toBeInTheDocument()
  })
})
