import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import ReviewPage from "../pages/Review"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockApi = vi.hoisted(() => ({
  getGame: vi.fn(),
  getGameTranscript: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ gameId: "g-620" }),
  }
})

vi.mock("../services/api", () => mockApi)

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
      replay_fen: {
        full: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        white: "4K3/PPPP1PPP/8/8/4P3/8/8/8 w - - 0 1",
        black: "8/8/8/4p3/8/8/pppp1ppp/rnbqkbnr w - - 0 1",
      },
    },
  ],
}

beforeEach(() => {
  mockNavigate.mockReset()
  mockApi.getGame.mockReset()
  mockApi.getGameTranscript.mockReset()
  mockApi.getGameTranscript.mockResolvedValue(transcript)
  mockApi.getGame.mockResolvedValue({ result: { winner: "white", reason: "checkmate" } })
})

afterEach(() => {
  cleanup()
})

describe("ReviewPage", () => {
  it("loads_transcript_and_navigates_moves", async () => {
    render(<ReviewPage />)

    await screen.findByText(/Move log/i)
    expect(screen.getByText("Ply 0 / 2")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("Ply 1 / 2")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Black Move attempt — Move complete/i }))
    expect(screen.getByText("Ply 2 / 2")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Black Move attempt — Move complete/i })).toHaveClass("is-active")
    expect(document.querySelectorAll(".review-page__announcement-badge").length).toBeGreaterThan(0)
  })

  it("supports_keyboard_navigation_and_perspective_toggle", async () => {
    render(<ReviewPage />)

    await screen.findByText(/Move log/i)

    fireEvent.keyDown(window, { key: "ArrowRight" })
    fireEvent.keyDown(window, { key: "ArrowRight" })
    await waitFor(() => {
      expect(screen.getByText("Ply 2 / 2")).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: "ArrowLeft" })
    await waitFor(() => {
      expect(screen.getByText("Ply 1 / 2")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("tab", { name: "Black" }))
    const board = document.querySelector(".chess-board")
    expect(board?.getAttribute("data-orientation")).toBe("white")
    fireEvent.click(screen.getByRole("tab", { name: "Black bottom" }))
    expect(board?.getAttribute("data-orientation")).toBe("black")
    expect(screen.getByText("Ply 1 / 2")).toBeInTheDocument()
  })

  it("shows_controlled_error_for_invalid_transcript", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({ game_id: "g-620", moves: null })

    render(<ReviewPage />)

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Replay transcript is unavailable.")
    })
  })
})
