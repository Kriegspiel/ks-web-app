import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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
  viewer_color: "white",
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
    game_code: "F5455A",
    rule_variant: "berkeley_any",
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
    expect(screen.getByText("Rules")).toBeInTheDocument()
    expect(screen.getByText("Berkeley + Any")).toBeInTheDocument()

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

  it("formats_typed_captures_numeric_pawn_tries_and_nonsense_in_the_move_log", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "wild16",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "e5d4",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "d4",
            captured_piece_announcement: "PAWN",
            next_turn_pawn_tries: 2,
            special: "CHECK_FILE",
          },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "a7a6",
          answer: { main: "NONSENSE" },
          move_done: false,
          replay_fen: transcript.moves[1].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(
      screen.getByRole("button", { name: /White \[e5d4\] Pawn captured at D4 · 2 pawn tries · Check on file/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Black \[a7a6\] Nonsense/i })).toBeInTheDocument()
  })

  it("shows_controlled_error_for_invalid_transcript", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({ game_id: "g-620", moves: null })

    renderReviewPage()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Replay transcript is unavailable.")
    })
  })

  it("surfaces_request_errors_when_review_loading_fails", async () => {
    mockApi.getGameTranscript.mockRejectedValueOnce({ message: "Replay exploded" })

    renderReviewPage()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Replay exploded")
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

  it("renders_sparse_review_metadata_and_black_first_move_rows", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "black",
          question_type: "ASK_ANY",
          uci: null,
          answer: { main: null, capture_square: null, special: "CHECK_DOUBLE" },
          move_done: false,
          timestamp: "2026-04-05T12:01:10Z",
          replay_fen: null,
        },
        {
          ply: 2,
          color: "white",
          question_type: "COMMON",
          uci: "??",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          timestamp: "2026-04-05T12:02:20Z",
          replay_fen: null,
        },
      ],
    })
    mockApi.getGame.mockResolvedValueOnce({
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "not-a-date",
      result: null,
      white: { username: "", role: "user" },
      black: {},
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByRole("button", { name: /Black Double check/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /White \[\?\?\] Move complete/i })).toBeInTheDocument()
    expect(screen.getByText("2m 20s")).toBeInTheDocument()
    expect(screen.getByText("Result: Result unavailable")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "White: —" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Black: —" })).toBeInTheDocument()
    expect(screen.getAllByText("—").length).toBeGreaterThan(3)

    fireEvent.click(screen.getByRole("button", { name: /White \[\?\?\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(0)
  })

  it("renders_castling_arrows_and_illegal_move_badges", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "e1g1",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "e7e5",
          answer: { main: "ILLEGAL_MOVE", capture_square: null, special: null },
          move_done: false,
          replay_fen: transcript.moves[1].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White \[e1g1\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: /Black \[e7e5\] Illegal move/i }))
    expect(document.querySelectorAll(".board-overlay__badge").length).toBeGreaterThan(0)
  })

  it("renders_black_queenside_castling_arrows", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "black",
          question_type: "COMMON",
          uci: "e8c8",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: transcript.moves[1].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /Black \[e8c8\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(2)
  })

  it("renders_white_queenside_and_black_kingside_castling_arrows", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "e1c1",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "e8g8",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: transcript.moves[1].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White \[e1c1\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(2)

    fireEvent.click(screen.getByRole("button", { name: /Black \[e8g8\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(2)
  })

  it("scrolls_the_active_move_into_view_when_it_overflows_the_log", async () => {
    const { container } = renderReviewPage()

    await screen.findByText(/Move log/i)

    const moveRows = container.querySelector(".review-page__move-rows")
    moveRows.scrollTo = vi.fn()
    moveRows.getBoundingClientRect = () => ({
      top: 0,
      bottom: 100,
      left: 0,
      right: 300,
      width: 300,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    Object.defineProperty(moveRows, "clientHeight", { configurable: true, value: 100 })

    const activeButton = screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i })
    activeButton.getBoundingClientRect = () => ({
      top: 120,
      bottom: 140,
      left: 0,
      right: 300,
      width: 300,
      height: 20,
      x: 0,
      y: 120,
      toJSON: () => ({}),
    })
    Object.defineProperty(activeButton, "offsetTop", { configurable: true, value: 200 })
    Object.defineProperty(activeButton, "offsetHeight", { configurable: true, value: 20 })

    fireEvent.click(activeButton)

    await waitFor(() => {
      expect(moveRows.scrollTo).toHaveBeenCalledWith({
        top: 120,
        behavior: "smooth",
      })
    })
  })

  it("returns_early_when_the_review_load_resolves_after_unmount", async () => {
    let resolveTranscript
    let resolveGame
    const transcriptPromise = new Promise((resolve) => {
      resolveTranscript = resolve
    })
    const gamePromise = new Promise((resolve) => {
      resolveGame = resolve
    })
    mockApi.getGameTranscript.mockReturnValueOnce(transcriptPromise)
    mockApi.getGame.mockReturnValueOnce(gamePromise)

    const { unmount } = renderReviewPage()
    expect(screen.getByText("Loading transcript…")).toBeInTheDocument()

    unmount()

    await act(async () => {
      resolveTranscript(transcript)
      resolveGame({
        created_at: "2026-04-05T12:00:00Z",
        updated_at: "2026-04-05T12:03:12Z",
        result: { winner: "white", reason: "checkmate" },
      })
      await Promise.all([transcriptPromise, gamePromise])
    })
  })

  it("skips_scrolling_when_the_active_row_lookup_returns_a_non_element", async () => {
    const { container } = renderReviewPage()

    await screen.findByText(/Move log/i)

    const moveRows = container.querySelector(".review-page__move-rows")
    moveRows.scrollTo = vi.fn()
    Object.defineProperty(moveRows, "querySelector", {
      configurable: true,
      value: vi.fn(() => ({})),
    })

    fireEvent.click(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i }))

    await waitFor(() => {
      expect(moveRows.querySelector).toHaveBeenCalledWith('[data-ply-index="0"]')
    })
    expect(moveRows.scrollTo).not.toHaveBeenCalled()
  })

  it("scrolls_the_active_move_to_the_top_when_it_sits_above_the_log", async () => {
    const { container } = renderReviewPage()

    await screen.findByText(/Move log/i)

    const moveRows = container.querySelector(".review-page__move-rows")
    moveRows.scrollTo = vi.fn()
    moveRows.getBoundingClientRect = () => ({
      top: 40,
      bottom: 140,
      left: 0,
      right: 300,
      width: 300,
      height: 100,
      x: 0,
      y: 40,
      toJSON: () => ({}),
    })
    Object.defineProperty(moveRows, "clientHeight", { configurable: true, value: 100 })

    const activeButton = screen.getByRole("button", { name: /White \[e2e4\] Move complete/i })
    activeButton.getBoundingClientRect = () => ({
      top: 20,
      bottom: 40,
      left: 0,
      right: 300,
      width: 300,
      height: 20,
      x: 0,
      y: 20,
      toJSON: () => ({}),
    })
    Object.defineProperty(activeButton, "offsetTop", { configurable: true, value: 24 })
    Object.defineProperty(activeButton, "offsetHeight", { configurable: true, value: 20 })

    fireEvent.click(activeButton)

    await waitFor(() => {
      expect(moveRows.scrollTo).toHaveBeenCalledWith({
        top: 24,
        behavior: "smooth",
      })
    })
  })
})
