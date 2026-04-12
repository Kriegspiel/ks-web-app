import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import ReviewPage from "../pages/Review"
const mockApi = vi.hoisted(() => ({
  getGame: vi.fn(),
  getGameTranscript: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useParams: () => ({ gameId: "g-620" }),
  }
})

vi.mock("../services/api", () => mockApi)
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "notifil" },
  }),
}))

const transcript = {
  game_id: "g-620",
  rule_variant: "berkeley_any",
  moves: [
    {
      ply: 1,
      color: "white",
      question_type: "COMMON",
      uci: "e2e4",
      answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
      move_done: true,
      timestamp: "2026-04-05T12:00:11Z",
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
      answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
      move_done: true,
      timestamp: "2026-04-05T12:00:19Z",
      replay_fen: {
        full: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        white: "4K3/PPPP1PPP/8/8/4P3/8/8/8 w - - 0 1",
        black: "8/8/8/4p3/8/8/pppp1ppp/rnbqkbnr w - - 0 1",
      },
    },
  ],
}

beforeEach(() => {
  mockApi.getGame.mockReset()
  mockApi.getGameTranscript.mockReset()
  mockApi.getGameTranscript.mockResolvedValue(transcript)
  mockApi.getGame.mockResolvedValue({
    created_at: "2026-04-05T12:00:00Z",
    updated_at: "2026-04-05T12:03:12Z",
    result: { winner: "white", reason: "checkmate" },
    white: {
      username: "notifil",
      connected: true,
      role: "user",
      ratings: {
        overall: { elo: 1500 },
        vs_humans: { elo: 1480 },
        vs_bots: { elo: 1510 },
      },
    },
    black: {
      username: "haiku",
      connected: true,
      role: "bot",
      ratings: {
        overall: { elo: 1450 },
        vs_humans: { elo: 1440 },
        vs_bots: { elo: 1460 },
      },
    },
    rating_snapshot: {
      overall: { white_before: 1484, black_before: 1466 },
      specific: { white_before: 1494, black_before: 1450 },
      white_track: "vs_bots",
      black_track: "vs_humans",
    },
  })
})

afterEach(() => {
  cleanup()
})

function renderReviewPage() {
  return render(
    <MemoryRouter>
      <ReviewPage />
    </MemoryRouter>,
  )
}

describe("ReviewPage", () => {
  it("shows_signed_in_user_in_header", async () => {
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/signed in as notifil\./i)).toBeInTheDocument()
  })

  it("loads_transcript_and_navigates_moves", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByText("Turn Start / 1B")).toBeInTheDocument()
    expect(screen.getByText("11s")).toBeInTheDocument()
    expect(screen.getByText("8s")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Turn 1W / 1B")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i }))
    expect(screen.getByText("Turn 1B / 1B")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i })).toHaveClass("is-active")
    expect(document.querySelectorAll(".review-page__announcement-badge").length).toBeGreaterThan(0)
  })

  it("supports_keyboard_navigation_and_perspective_toggle", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)

    fireEvent.keyDown(window, { key: "ArrowRight" })
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i })).toHaveClass("is-active")
    })
    fireEvent.keyDown(window, { key: "ArrowRight" })
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i })).toHaveClass("is-active")
    })

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i })).toHaveClass("is-active")
    })

    fireEvent.click(screen.getByRole("tab", { name: "Black" }))
    const board = document.querySelector(".chess-board")
    expect(board?.getAttribute("data-orientation")).toBe("white")
    fireEvent.click(screen.getByRole("tab", { name: "Black bottom" }))
    expect(board?.getAttribute("data-orientation")).toBe("black")
    expect(screen.getByText("Turn 1W / 1B")).toBeInTheDocument()
  })

  it("hides_opponent_overlays_in_private_views", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole("tab", { name: "White" }))
    expect(document.querySelectorAll(".board-overlay__arrow").length).toBe(0)
  })

  it("keeps_capture_highlights_visible_in_private_views", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "black",
          question_type: "COMMON",
          uci: "e7e5",
          answer: { main: "CAPTURE_DONE", capture_square: "e4", special: null },
          move_done: true,
          timestamp: "2026-04-05T12:00:19Z",
          replay_fen: transcript.moves[1].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("tab", { name: "White" }))
    fireEvent.click(screen.getByRole("button", { name: /Black \[e7e5\] Capture at E4/i }))

    expect(document.querySelectorAll(".board-overlay__arrow").length).toBe(0)
    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--capture")
  })

  it("shows_controlled_error_for_invalid_transcript", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({ game_id: "g-620", moves: null })

    renderReviewPage()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Replay transcript is unavailable.")
    })
  })

  it("combines_move_attempts_with_referee_replies_in_one_announcement", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "ASK_ANY",
          uci: null,
          answer: { main: "NO_ANY", capture_square: null, special: null },
          move_done: false,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "white",
          question_type: "COMMON",
          uci: "b2b4",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByRole("button", { name: /White No pawn captures · \[b2b4\] Move complete/i })).toBeInTheDocument()
    expect(screen.queryByText("Ask any pawn captures")).not.toBeInTheDocument()
  })

  it("shows_bottom_game_stats", async () => {
    renderReviewPage()

    await screen.findByText(/Game stats/i)
    expect(screen.getByRole("link", { name: "notifil" })).toHaveAttribute("href", "/user/notifil")
    expect(screen.getByRole("link", { name: "haiku (bot)" })).toHaveAttribute("href", "/user/haiku")
    expect(screen.getByText("2026-04-05 12:00:00 UTC")).toBeInTheDocument()
    expect(screen.getByText("3m 12s")).toBeInTheDocument()
  })
})
