import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
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
    moves: [
      {
        ply: 1,
        color: "white",
        question_type: "COMMON",
        uci: "e2e4",
        move_done: true,
        answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
        replay_fen: {
          full: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
          white: "4K3/PPPP1PPP/8/8/4P3/8/8/8 b - - 0 1",
          black: "8/8/8/8/8/8/pppppppp/rnbqkbnr b - - 0 1",
        },
      },
      {
        ply: 2,
        color: "black",
        question_type: "COMMON",
        uci: "e7e5",
        move_done: true,
        answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
        replay_fen: {
          full: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
          white: "4K3/PPPP1PPP/8/8/4P3/8/8/8 w - - 0 1",
          black: "8/8/8/4p3/8/8/pppp1ppp/rnbqkbnr w - - 0 1",
        },
      },
    ],
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
      analyzed_moves: 2,
      best_moves: 1,
      inaccuracies: 0,
      mistakes: 1,
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
          check_pressure: 4,
          safety_penalty: -2,
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
      {
        ply: 2,
        color: "black",
        uci: "e7e5",
        move_done: true,
        label: "mistake",
        confidence: "medium",
        score: -16.5,
        best_uci: "g8f6",
        best_score: 8.5,
        move_delta: -25,
        side_to_move_label: "white has the initiative",
        explanation: "Black's e7e5 gives White a clearer route to pressure. The safer candidate was g8f6.",
        deterministic_explanation: "Black's e7e5 loses value.",
        top_alternatives: [{ uci: "g8f6", score: 8.5 }, { uci: "e7e5", score: -16.5 }],
        reasons: [
          {
            name: "safety_penalty",
            value: -18,
            direction: "negative",
            description: "It leaves a visible reply risk for the opponent.",
          },
        ],
        components: {
          development: 10,
          check_pressure: 0,
          safety_penalty: -18,
          legality_penalty: -1,
        },
        probabilities: {
          legal_probability: 0.91,
          capture_probability: 0.03,
          check_probability: 0.02,
          exposed_piece_capture_probability: 0.46,
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
  it("renders_t3_replay_summary_board_controls_and_start_state", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "T3 replay" })).toBeInTheDocument()
    expect(mockApi.getGameT3Review).toHaveBeenCalledWith("T3A9B7")
    expect(screen.getByText("fil vs llm_gptnano · Wild 16")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Replay" })).toHaveAttribute("href", "/game/T3A9B7/review")
    expect(screen.getByRole("grid", { name: "Chess board" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Play replay" })).toBeInTheDocument()
    expect(screen.getByLabelText("Replay position counter")).toHaveTextContent("Start/1B")
    expect(screen.getByRole("heading", { name: "Game start" })).toBeInTheDocument()
    expect(screen.getByText("No move selected.")).toBeInTheDocument()

    const summary = screen.getByLabelText("T3 analysis summary")
    expect(within(summary).getByText("Analyzed")).toBeInTheDocument()
    expect(within(summary).getByText("2")).toBeInTheDocument()
  })

  it("updates_the_coaching_panel_as_replay_moves", async () => {
    renderPage()

    await screen.findByRole("heading", { name: "T3 replay" })

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByLabelText("Replay position counter")).toHaveTextContent("1W/1B")
    expect(screen.getByText("White e2e4")).toBeInTheDocument()
    expect(screen.getByText("position looks unclear")).toBeInTheDocument()
    expect(screen.getByText("White's e2e4 looks good. It improves development without creating a large public risk.")).toBeInTheDocument()
    expect(screen.getByText("11%")).toBeInTheDocument()
    expect(screen.getAllByText("e2e4").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByLabelText("Replay position counter")).toHaveTextContent("1B/1B")
    expect(screen.getByText("Black e7e5")).toBeInTheDocument()
    expect(screen.getByText("white has the initiative")).toBeInTheDocument()
    expect(screen.getByText("Black's e7e5 gives White a clearer route to pressure. The safer candidate was g8f6.")).toBeInTheDocument()
    expect(screen.getByText("-25.0")).toBeInTheDocument()
    expect(screen.getByText("46%")).toBeInTheDocument()
    expect(screen.getByText("g8f6")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Go to 1W e2e4" }))
    expect(screen.getByLabelText("Replay position counter")).toHaveTextContent("1W/1B")
  })

  it("renders_api_errors", async () => {
    mockApi.getGameT3Review.mockRejectedValue({ message: "No analysis" })
    renderPage()

    expect(await screen.findByText("No analysis")).toBeInTheDocument()
  })
})
