import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
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
    expect(screen.getByText("Start/1B")).toBeInTheDocument()
    expect(screen.getByText("11s")).toBeInTheDocument()
    expect(screen.getByText("8s")).toBeInTheDocument()
    expect(screen.getByLabelText("Replay time remaining")).toBeInTheDocument()
    expect(screen.getByLabelText("Replay material status")).toBeInTheDocument()
    expect(screen.getByText("Rules")).toBeInTheDocument()
    expect(screen.getByText("Berkeley + Any")).toBeInTheDocument()
    const gameDetails = screen.getByRole("heading", { name: "Game details" }).closest(".review-page__stats-card")
    expect(within(gameDetails).getByText("Result")).toBeInTheDocument()
    expect(within(gameDetails).getByText("white wins by checkmate")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText("1W/1B")).toBeInTheDocument()
    expect(within(screen.getByLabelText("Replay time remaining")).getByText("25:10")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i }))
    expect(screen.getByText("1B/1B")).toBeInTheDocument()
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
    expect(screen.getByText("1W/1B")).toBeInTheDocument()
  })

  it("keeps_board_orientation_controls_above_the_replay_board", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)

    const perspectiveControls = screen.getByRole("tablist", { name: "Replay perspective" })
    const orientationControls = screen.getByRole("tablist", { name: "Board orientation" })
    const board = document.querySelector(".chess-board")
    expect(perspectiveControls.closest(".review-page__toolbar-group")).not.toBe(
      orientationControls.closest(".review-page__toolbar-group"),
    )
    expect(perspectiveControls.closest(".review-page__toolbar-line")).toBe(
      orientationControls.closest(".review-page__toolbar-line"),
    )
    expect(orientationControls.compareDocumentPosition(board) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("keeps_replay_controls_immediately_under_the_board", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)

    const controls = screen.getByRole("group", { name: "Replay controls" })
    const logHeader = document.querySelector(".review-page__log-header")
    const boardToolbar = document.querySelector(".review-page__board-toolbar")
    const board = document.querySelector(".chess-board")
    expect(within(controls).getByText("Start/1B")).toBeInTheDocument()
    expect(within(logHeader).queryByText("Turn Start / 1B")).not.toBeInTheDocument()
    expect(within(boardToolbar).queryByText("Start/1B")).not.toBeInTheDocument()
    expect(board.compareDocumentPosition(controls) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("syncs_the_move_log_card_height_to_the_board_card_on_desktop", async () => {
    const originalMatchMedia = window.matchMedia
    const originalRequestAnimationFrame = window.requestAnimationFrame
    const originalCancelAnimationFrame = window.cancelAnimationFrame
    const getComputedStyleSpy = vi.spyOn(window, "getComputedStyle")
    window.matchMedia = vi.fn(() => ({
      matches: true,
      media: "(min-width: 769px)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    }))
    window.requestAnimationFrame = (callback) => {
      callback()
      return 1
    }
    window.cancelAnimationFrame = vi.fn()

    try {
      const { container } = renderReviewPage()
      await screen.findByText(/Move log/i)

      const boardCard = container.querySelector(".review-page__board-column")
      const [toolbar, chessBoard, replayControls, boardMeta] = boardCard.children
      boardCard.getBoundingClientRect = () => ({
        top: 100,
        bottom: 1700,
        left: 0,
        right: 640,
        width: 640,
        height: 1600,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      })
      toolbar.getBoundingClientRect = () => ({
        top: 120,
        bottom: 172,
        left: 0,
        right: 640,
        width: 640,
        height: 52,
        x: 0,
        y: 120,
        toJSON: () => ({}),
      })
      chessBoard.getBoundingClientRect = () => ({
        top: 188,
        bottom: 568,
        left: 0,
        right: 640,
        width: 640,
        height: 380,
        x: 0,
        y: 188,
        toJSON: () => ({}),
      })
      replayControls.getBoundingClientRect = () => ({
        top: 584,
        bottom: 626,
        left: 0,
        right: 640,
        width: 640,
        height: 42,
        x: 0,
        y: 584,
        toJSON: () => ({}),
      })
      boardMeta.getBoundingClientRect = () => ({
        top: 642,
        bottom: 700,
        left: 0,
        right: 640,
        width: 640,
        height: 58,
        x: 0,
        y: 642,
        toJSON: () => ({}),
      })
      getComputedStyleSpy.mockImplementation((element) => ({
        getPropertyValue: (property) => {
          if (element === boardCard && property === "padding-bottom") {
            return "16px"
          }
          if (element === boardCard && property === "border-bottom-width") {
            return "2px"
          }
          if (property === "margin-bottom") {
            return "0px"
          }
          return "0px"
        },
        paddingBottom: element === boardCard ? "16px" : "0px",
        borderBottomWidth: element === boardCard ? "2px" : "0px",
        marginBottom: "0px",
      }))

      window.dispatchEvent(new Event("resize"))

      await waitFor(() => {
        expect(container.querySelector(".review-page__log-column")?.style.height).toBe("618px")
      })
      expect(container.querySelector(".review-page__move-rows")).toBeInTheDocument()
    } finally {
      window.matchMedia = originalMatchMedia
      window.requestAnimationFrame = originalRequestAnimationFrame
      window.cancelAnimationFrame = originalCancelAnimationFrame
      getComputedStyleSpy.mockRestore()
    }
  })

  it("uses_under_board_controls_to_step_through_replay", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)

    const controls = screen.getByRole("group", { name: "Replay controls" })
    fireEvent.click(within(controls).getByRole("button", { name: "Next" }))
    expect(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i })).toHaveClass("is-active")

    fireEvent.click(within(controls).getByRole("button", { name: "Next" }))
    expect(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i })).toHaveClass("is-active")

    fireEvent.click(within(controls).getByRole("button", { name: "Prev" }))
    expect(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i })).toHaveClass("is-active")
  })

  it("plays_and_pauses_replay_one_ply_per_second", async () => {
    renderReviewPage()

    await screen.findByText(/Move log/i)
    vi.useFakeTimers()

    try {
      const controls = screen.getByRole("group", { name: "Replay controls" })
      fireEvent.click(within(controls).getByRole("button", { name: "Play replay" }))
      expect(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i })).toHaveClass("is-active")
      expect(within(controls).getByText("1W/1B")).toBeInTheDocument()
      expect(within(controls).getByRole("button", { name: "Pause replay" })).toBeInTheDocument()
      expect(within(controls).getByText("❚❚")).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(screen.getByRole("button", { name: /Black \[e7e5\] Move complete/i })).toHaveClass("is-active")
      expect(within(controls).getByText("1B/1B")).toBeInTheDocument()
      await act(async () => {})
      expect(within(controls).getByRole("button", { name: "Play replay" })).toBeInTheDocument()
      expect(within(controls).getByText("▶")).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
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

  it("formats_typed_captures_numeric_pawn_tries_and_hides_nonsense_in_the_move_log", async () => {
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
      screen.getByRole("button", { name: /White \[e5d4\] Pawn captured at D4 · Check on file/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Black 2 pawn tries/i })).toBeInTheDocument()
    expect(screen.queryByText(/Nonsense/i)).not.toBeInTheDocument()
  })

  it("marks_crazykrieg_drops_with_a_green_board_circle", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-drop",
      rule_variant: "crazykrieg",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "P@e4",
          answer: { main: "REGULAR_MOVE", dropped_piece_announcement: "PAWN", special: null },
          move_done: true,
          timestamp: "2026-04-05T12:00:11Z",
          replay_fen: {
            full: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            white: "4K3/PPPP1PPP/8/8/4P3/8/8/8 b - - 0 1",
            black: "8/8/8/8/8/8/pppppppp/rnbqkbnr b - - 0 1",
          },
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White \[p@e4\] Move complete/i }))

    expect(document.querySelector(".board-overlay__badge--success")).toBeInTheDocument()
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(0)
  })

  it("shows_crazykrieg_replay_reserves_below_the_board", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_code: "EZYR2R",
      rule_variant: "crazykrieg",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:03:12Z",
      result: null,
      white: { username: "notifil", role: "user" },
      black: { username: "haiku", role: "bot" },
    })
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-crazy",
      rule_variant: "crazykrieg",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "e4f5",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "f5",
            captured_piece_announcement: "KNIGHT",
            special: null,
          },
          move_done: true,
          timestamp: "2026-04-05T12:00:11Z",
          replay_fen: {
            full: "rnbqkb1r/pppppppp/8/5P2/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            white: "4K3/PPPP1PPP/8/5P2/8/8/8/8 b - - 0 1",
            black: "8/8/8/8/8/8/pppppppp/rnbqkb1r b - - 0 1",
          },
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "h7h6",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          timestamp: "2026-04-05T12:00:15Z",
          replay_fen: {
            full: "rnbqkb1r/ppppppp1/7p/5P2/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
            white: "4K3/PPPP1PPP/8/5P2/8/8/8/8 w - - 0 1",
            black: "8/8/7p/8/8/8/ppppppp1/rnbqkb1r w - - 0 1",
          },
        },
        {
          ply: 3,
          color: "white",
          question_type: "COMMON",
          uci: "N@c4",
          answer: { main: "REGULAR_MOVE", dropped_piece_announcement: "KNIGHT", special: null },
          move_done: true,
          timestamp: "2026-04-05T12:00:20Z",
          replay_fen: {
            full: "rnbqkb1r/ppppppp1/7p/5P2/2N5/8/PPPP1PPP/RNBQKBNR b KQkq - 1 2",
            white: "4K3/PPPP1PPP/8/5P2/2N5/8/8/8 b - - 0 1",
            black: "8/8/7p/8/8/8/ppppppp1/rnbqkb1r b - - 0 1",
          },
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByLabelText("White reserve")).toBeInTheDocument()
    expect(screen.getByLabelText("Black reserve")).toBeInTheDocument()
    expect(within(screen.getByLabelText("White reserve")).getByLabelText("Knight reserve piece (0)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /White \[e4f5\] Knight captured at F5/i }))
    expect(within(screen.getByLabelText("White reserve")).getByLabelText("Knight reserve piece (1)")).toBeInTheDocument()
    expect(within(screen.getByLabelText("Black reserve")).getByLabelText("Knight reserve piece (0)")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /White \[n@c4\] Move complete/i }))
    expect(within(screen.getByLabelText("White reserve")).getByLabelText("Knight reserve piece (0)")).toBeInTheDocument()
  })

  it("counts_only_board_pieces_for_crazykrieg_material_when_fen_has_reserve_pocket", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_code: "EZYR2R",
      rule_variant: "crazykrieg",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:03:12Z",
      result: null,
      white: { username: "notifil", role: "user" },
      black: { username: "haiku", role: "bot" },
    })
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-crazy-pocket",
      rule_variant: "crazykrieg",
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
            full: "4k3/8/8/8/4P3/8/4K3/4Q3[PNBRQPNBRQpnbrq] b - - 0 1",
            white: "8/8/8/8/4P3/8/4K3/4Q3 b - - 0 1",
            black: "4k3/8/8/8/8/8/8/8 b - - 0 1",
          },
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White \[e2e4\] Move complete/i }))

    const material = screen.getByLabelText("Replay material status")
    const whiteView = within(material).getByLabelText("White material view")
    const blackView = within(material).getByLabelText("Black material view")
    expect(within(whiteView).getByText("Black pieces remain:")).toBeInTheDocument()
    expect(within(whiteView).getByText("1")).toBeInTheDocument()
    expect(within(blackView).getByText("White pieces remain:")).toBeInTheDocument()
    expect(within(blackView).getByText("3")).toBeInTheDocument()
    expect(within(blackView).queryByText("13")).not.toBeInTheDocument()
  })

  it("places_next_turn_pawn_announcements_at_the_start_of_the_next_ply_group", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "wild16",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "g2g4",
          answer: {
            main: "REGULAR_MOVE",
            next_turn_pawn_tries: 0,
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "d7d5",
          answer: { main: "ILLEGAL_MOVE", special: null },
          move_done: false,
          replay_fen: transcript.moves[1].replay_fen,
        },
        {
          ply: 3,
          color: "black",
          question_type: "COMMON",
          uci: "d7d5",
          answer: {
            main: "REGULAR_MOVE",
            next_turn_pawn_tries: 1,
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[1].replay_fen,
        },
        {
          ply: 4,
          color: "white",
          question_type: "COMMON",
          uci: "d2d3",
          answer: { main: "REGULAR_MOVE", special: null },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByRole("button", { name: /White \[g2g4\] Move complete/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /White \[g2g4\] Move complete · No pawn captures/i })).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", {
        name: /Black No pawn captures · \[d7d5\] Illegal move · \[d7d5\] Move complete/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /White 1 pawn try · \[d2d3\] Move complete/i })).toBeInTheDocument()
  })

  it("shows_rand_pawn_try_source_square_announcements_at_the_start_of_the_next_ply_group", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-rand",
      rule_variant: "rand",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "e2e4",
          answer: {
            main: "REGULAR_MOVE",
            next_turn_pawn_try_squares: [],
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "d7d5",
          answer: {
            main: "REGULAR_MOVE",
            next_turn_pawn_try_squares: ["e4"],
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[1].replay_fen,
        },
        {
          ply: 3,
          color: "white",
          question_type: "COMMON",
          uci: "e4d5",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "d5",
            captured_piece_announcement: "PAWN",
            next_turn_pawn_try_squares: ["c7", "e7"],
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 4,
          color: "black",
          question_type: "COMMON",
          uci: "g8f6",
          answer: { main: "REGULAR_MOVE", special: null },
          move_done: true,
          replay_fen: transcript.moves[1].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByRole("button", { name: /Black No pawn captures · \[d7d5\] Move complete/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /White Pawn try from E4 · \[e4d5\] Pawn captured at D5/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Black Pawn tries from C7, E7 · \[g8f6\] Move complete/i })).toBeInTheDocument()
  })

  it("updates_replay_material_stats_from_the_selected_position_and_capture_announcements", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_code: "F5455A",
      rule_variant: "cincinnati",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:03:12Z",
      result: { winner: "white", reason: "checkmate" },
      white: { username: "notifil", connected: true, role: "user" },
      black: { username: "haiku", connected: true, role: "bot" },
    })
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "cincinnati",
      viewer_color: "white",
      moves: [
        transcript.moves[0],
        {
          ...transcript.moves[1],
          answer: {
            main: "REGULAR_MOVE",
            capture_square: null,
            special: null,
            next_turn_has_pawn_capture: true,
          },
        },
        {
          ply: 3,
          color: "white",
          question_type: "COMMON",
          uci: "e4d5",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "d5",
            captured_piece_announcement: "PAWN",
            special: null,
          },
          move_done: true,
          timestamp: "2026-04-05T12:00:28Z",
          replay_fen: {
            full: "rnbqkbnr/ppp2ppp/8/3Pp3/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2",
            white: "4K3/PPPP1PPP/8/3P4/8/8/8/8 b - - 0 1",
            black: "8/8/8/4p3/8/8/ppp2ppp/rnbqkbnr b - - 0 1",
          },
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White .* \[e4d5\] Pawn captured at D5/i }))

    const material = screen.getByLabelText("Replay material status")
    const whiteView = within(material).getByLabelText("White material view")
    const blackView = within(material).getByLabelText("Black material view")
    expect(within(whiteView).getByText("Black pieces remain:")).toBeInTheDocument()
    expect(within(whiteView).getByText("15")).toBeInTheDocument()
    expect(within(whiteView).getByText("Black pawns captured:")).toBeInTheDocument()
    expect(within(whiteView).getByText("1")).toBeInTheDocument()
    expect(within(blackView).getByText("White pieces remain:")).toBeInTheDocument()
    expect(within(blackView).getByText("16")).toBeInTheDocument()
  })

  it("hides_pawn_capture_counts_for_english_review_because_captures_are_untyped", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_code: "NJ9M6F",
      rule_variant: "english",
      created_at: "2026-05-09T17:00:00Z",
      updated_at: "2026-05-09T17:09:51Z",
      result: { winner: "white", reason: "checkmate" },
      white: { username: "hikaru_sokolovsky", connected: true, role: "guest" },
      black: { username: "bot", connected: true, role: "bot" },
    })
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-english",
      rule_variant: "english",
      viewer_color: "white",
      moves: [
        transcript.moves[0],
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "e7e5",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          timestamp: "2026-05-09T17:00:15Z",
          replay_fen: transcript.moves[1].replay_fen,
        },
        {
          ply: 3,
          color: "white",
          question_type: "COMMON",
          uci: "f1b5",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "b5",
            captured_piece_announcement: null,
            special: null,
          },
          move_done: true,
          timestamp: "2026-05-09T17:00:22Z",
          replay_fen: {
            full: "rnbqkbnr/pppp1ppp/8/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 0 2",
            white: "4K3/PPPP1PPP/8/1B6/4P3/8/8/8 b - - 0 1",
            black: "8/8/8/4p3/8/8/pppp1ppp/rnbqkbnr b - - 0 1",
          },
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White \[f1b5\] Capture at B5/i }))

    const material = screen.getByLabelText("Replay material status")
    expect(within(material).getByText("Black pieces remain:")).toBeInTheDocument()
    expect(within(material).getByText("White pieces remain:")).toBeInTheDocument()
    expect(within(material).queryByText("Black pawns captured:")).not.toBeInTheDocument()
    expect(within(material).queryByText("White pawns captured:")).not.toBeInTheDocument()
  })

  it("uses_cincinnati_has_pawn_capture_flags_instead_of_treating_null_pawn_tries_as_zero", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "cincinnati",
      moves: [
        {
          ply: 1,
          color: "white",
          question_type: "COMMON",
          uci: "c4b5",
          answer: {
            main: "REGULAR_MOVE",
            next_turn_pawn_tries: null,
            next_turn_has_pawn_capture: true,
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
        {
          ply: 2,
          color: "black",
          question_type: "COMMON",
          uci: "e3c5",
          answer: {
            main: "REGULAR_MOVE",
            next_turn_pawn_tries: null,
            next_turn_has_pawn_capture: false,
            special: null,
          },
          move_done: true,
          replay_fen: transcript.moves[1].replay_fen,
        },
        {
          ply: 3,
          color: "white",
          question_type: "COMMON",
          uci: "b1c3",
          answer: { main: "REGULAR_MOVE", special: null },
          move_done: true,
          replay_fen: transcript.moves[0].replay_fen,
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    expect(screen.getByRole("button", { name: /Black Has pawn capture · \[e3c5\] Move complete/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Black No pawn captures · \[e3c5\] Move complete/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /White No pawn captures · \[b1c3\] Move complete/i })).toBeInTheDocument()
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
    const gameDetails = screen.getByRole("heading", { name: "Game details" }).closest(".review-page__stats-card")
    expect(within(gameDetails).getByText("Result unavailable")).toBeInTheDocument()
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

  it("does_not_render_castling_arrows_for_non_king_moves_on_castling_squares", async () => {
    mockApi.getGameTranscript.mockResolvedValueOnce({
      game_id: "g-620",
      rule_variant: "berkeley_any",
      moves: [
        {
          ply: 1,
          color: "black",
          question_type: "COMMON",
          uci: "h7h6",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: {
            full: "4k3/8/7p/8/8/8/5K2/4R3 w - - 0 1",
            white: "8/8/8/8/8/8/5K2/4R3 w - - 0 1",
            black: "4k3/8/7p/8/8/8/8/8 w - - 0 1",
          },
        },
        {
          ply: 2,
          color: "white",
          question_type: "COMMON",
          uci: "e1g1",
          answer: { main: "REGULAR_MOVE", capture_square: null, special: null },
          move_done: true,
          replay_fen: {
            full: "4k3/8/7p/8/8/8/5K2/6R1 b - - 1 1",
            white: "8/8/8/8/8/8/5K2/6R1 b - - 0 1",
            black: "4k3/8/7p/8/8/8/8/8 b - - 0 1",
          },
        },
      ],
    })

    renderReviewPage()

    await screen.findByText(/Move log/i)
    fireEvent.click(screen.getByRole("button", { name: /White \[e1g1\] Move complete/i }))
    expect(document.querySelectorAll(".board-overlay__arrow")).toHaveLength(1)
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
