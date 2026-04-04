import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import GamePage from "../pages/GamePage"
import { TEST_VERSION_STAMP } from "../version"

const mockNavigate = vi.hoisted(() => vi.fn())

const mockApi = vi.hoisted(() => ({
  getGame: vi.fn(),
  getGameState: vi.fn(),
  deleteWaitingGame: vi.fn(),
  submitMove: vi.fn(),
  askAny: vi.fn(),
  resignGame: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ gameId: "g-123" }),
  }
})

vi.mock("../services/api", () => mockApi)

const activeState = {
  game_id: "g-123",
  state: "active",
  turn: "white",
  move_number: 1,
  your_color: "white",
  your_fen: "8/8/8/8/8/8/4P3/4K3",
  allowed_moves: ["e2e4"],
  referee_log: [{ turn: 1, color: "white", announcement: "White to move" }],
  possible_actions: ["move", "ask_any"],
  clock: { white_remaining: 601, black_remaining: 598, active_color: "white" },
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

beforeEach(() => {
  window.localStorage.clear()
  window.scrollTo = vi.fn()
  mockNavigate.mockReset()
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getGame.mockResolvedValue({
    game_id: "g-123",
    game_code: "ABC123",
    rule_variant: "berkeley_any",
    state: "active",
    opponent_type: "bot",
    white: { username: "fil", role: "user", connected: true },
    black: { username: "gptnano", role: "bot", connected: true },
    turn: "white",
    move_number: 1,
    created_at: "2026-04-02T12:00:00Z",
  })
  mockApi.getGameState.mockResolvedValue(activeState)
  mockApi.deleteWaitingGame.mockResolvedValue({})
  mockApi.submitMove.mockResolvedValue({ move_done: true })
  mockApi.askAny.mockResolvedValue({ has_any: false })
  mockApi.resignGame.mockResolvedValue({ result: { winner: "black", reason: "resignation" } })
})

afterEach(() => {
  cleanup()
})

describe("GamePage", () => {
  it("polls_every_500ms_while_active", async () => {
    render(<GamePage />)

    await screen.findByText(/Game ID:/i)
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    expect(mockApi.getGameState).toHaveBeenCalledTimes(1)

    await sleep(650)
    await waitFor(() => expect(mockApi.getGameState).toHaveBeenCalledTimes(2))
  })

  it("submits_two_click_move_and_repolls", async () => {
    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e2" })

    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    await waitFor(() => {
      expect(mockApi.submitMove).toHaveBeenCalledWith("g-123", "e2e4")
      expect(mockApi.getGameState.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    expect(screen.getByRole("button", { name: "Square e2" })).toHaveClass("square--last-move")
    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--last-move")
  })

  it("shows_only_backend_legal_move_dots_for_the_selected_piece", async () => {
    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e2" })
    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))

    const e3 = screen.getAllByRole("button", { name: "Square e3" }).at(-1)
    const e4 = screen.getAllByRole("button", { name: "Square e4" }).at(-1)

    expect(e4.querySelector(".square__move-dot")).toBeTruthy()
    expect(e3.querySelector(".square__move-dot")).toBeFalsy()
  })

  it("shows_all_backend_legal_targets_for_a_selected_kriegspiel_pawn", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/4P3/8/8/4K3",
      allowed_moves: ["e4d5", "e4e5", "e4f5"],
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    const d5 = screen.getAllByRole("button", { name: "Square d5" }).at(-1)
    const e5 = screen.getAllByRole("button", { name: "Square e5" }).at(-1)
    const f5 = screen.getAllByRole("button", { name: "Square f5" }).at(-1)

    expect(d5).toHaveClass("square--suggested")
    expect(e5).toHaveClass("square--suggested")
    expect(f5).toHaveClass("square--suggested")
    expect(e5.querySelector(".square__move-dot")).toBeTruthy()
  })

  it("allows_selecting_a_backend_legal_source_square_even_when_the_piece_is_not_visible", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4f5"],
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--highlighted")
    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).toHaveClass("square--suggested")
  })

  it("highlights_illegal_move_squares_in_red", async () => {
    mockApi.submitMove.mockResolvedValueOnce({ move_done: false })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e2" })
    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    await waitFor(() => {
      expect(mockApi.submitMove).toHaveBeenCalledWith("g-123", "e2e4")
    })

    expect(screen.getByRole("button", { name: "Square e2" })).toHaveClass("square--illegal")
    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--illegal")
    expect(screen.getByText("Illegal move. Try a different move.")).toBeInTheDocument()
  })

  it("gates_promotion_with_modal_and_appends_suffix", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/P7/8/8/8/8/8/8",
      allowed_moves: ["a7a8q", "a7a8r", "a7a8b", "a7a8n"],
    })

    render(<GamePage />)
    await screen.findByRole("button", { name: "Square a7" })

    fireEvent.click(screen.getByRole("button", { name: "Square a7" }))
    fireEvent.click(screen.getByRole("button", { name: "Square a8" }))

    expect(screen.getByRole("dialog", { name: "Choose promotion piece" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Knight" }))

    await waitFor(() => {
      expect(mockApi.submitMove).toHaveBeenCalledWith("g-123", "a7a8n")
    })
  })

  it("shows_clocks_above_board", async () => {
    render(<GamePage />)

    await screen.findByLabelText(/Game clocks/i)
    expect(screen.getByText("10:01")).toBeInTheDocument()
    expect(screen.getByText("9:58")).toBeInTheDocument()
  })

  it("auto_follows_new_referee_entries_only_while_log_is_near_bottom", async () => {
    const firstState = {
      ...activeState,
      referee_log: [{ turn: 1, color: "white", announcement: "White to move" }],
    }
    const secondState = {
      ...activeState,
      referee_log: [
        { turn: 1, color: "white", announcement: "White to move" },
        { turn: 1, color: "black", announcement: "Black replied" },
      ],
    }

    mockApi.getGameState
      .mockResolvedValueOnce(firstState)
      .mockResolvedValueOnce(secondState)

    render(<GamePage />)

    const log = await screen.findByRole("log", { name: "Referee log by turn" })
    Object.defineProperty(log, "scrollHeight", { value: 500, configurable: true })
    Object.defineProperty(log, "clientHeight", { value: 120, configurable: true })
    Object.defineProperty(log, "scrollTop", { value: 0, writable: true, configurable: true })

    await waitFor(() => {
      expect(log.scrollTop).toBe(500)
    })

    log.scrollTop = 100
    fireEvent.scroll(log)

    await waitFor(() => {
      expect(mockApi.getGameState).toHaveBeenCalledTimes(2)
    })

    expect(log.scrollTop).toBe(100)
  })

  it("shows_rules_and_opponent_in_status_from_metadata", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_id: "g-123",
      game_code: "ABC123",
      rule_variant: "berkeley_any",
      state: "active",
      opponent_type: "bot",
      white: { username: "fil", role: "user", elo: 1400 },
      black: { username: "gptnano", role: "bot", elo: 1342 },
      turn: "white",
      move_number: 1,
      created_at: "2026-04-02T12:00:00Z",
    })

    render(<GamePage />)

    expect(await screen.findByText("Berkeley Any")).toBeInTheDocument()
    expect(screen.getByText("gptnano (bot)")).toBeInTheDocument()
    expect(screen.getByText("1342")).toBeInTheDocument()
  })

  it("shows_close_for_waiting_games_and_returns_to_lobby", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_id: "g-123",
      game_code: "ABC123",
      rule_variant: "berkeley_any",
      state: "waiting",
      opponent_type: "human",
      white: { username: "fil", role: "user", connected: true },
      black: null,
      turn: "white",
      move_number: 0,
      created_at: "2026-04-02T12:00:00Z",
    })
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      state: "waiting",
      possible_actions: [],
      move_number: 0,
    })

    render(<GamePage />)

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("g-123")
      expect(mockNavigate).toHaveBeenCalledWith("/lobby")
    })
  })

  it("anchors_phantom_menu_to_the_target_square", async () => {
    render(<GamePage />)

    const square = await screen.findByRole("button", { name: "Square d5" })
    square.getBoundingClientRect = () => ({
      x: 200, y: 240, left: 200, top: 240, right: 264, bottom: 304, width: 64, height: 64,
      toJSON: () => {},
    })

    const boardShell = square.closest(".game-board-shell")
    boardShell.getBoundingClientRect = () => ({
      x: 100, y: 120, left: 100, top: 120, right: 620, bottom: 640, width: 520, height: 520,
      toJSON: () => {},
    })

    fireEvent.contextMenu(square)

    const menu = screen.getByRole("dialog", { name: /Phantom options for d5/i })
    expect(menu).toHaveStyle({ left: "170px", top: "116px" })
    expect(within(menu).getByText("Add a phantom piece.")).toBeInTheDocument()
    expect(within(menu).getAllByText("d5")).toHaveLength(1)
  })

  it("opens_the_phantom_menu_on_double_tap_for_mobile_style_taps", async () => {
    let now = new Date("2026-04-03T10:00:00Z").valueOf()
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now)

    render(<GamePage />)

    const square = await screen.findByRole("button", { name: "Square d5" })
    square.getBoundingClientRect = () => ({
      x: 200, y: 240, left: 200, top: 240, right: 264, bottom: 304, width: 64, height: 64,
      toJSON: () => {},
    })

    const boardShell = square.closest(".game-board-shell")
    boardShell.getBoundingClientRect = () => ({
      x: 100, y: 120, left: 100, top: 120, right: 620, bottom: 640, width: 520, height: 520,
      toJSON: () => {},
    })

    fireEvent.click(square)

    now += 150
    fireEvent.click(square)

    expect(await screen.findByRole("dialog", { name: /Phantom options for d5/i })).toBeInTheDocument()

    nowSpy.mockRestore()
  })

  it("supports_phantom_add_and_remove", async () => {
    render(<GamePage />)

    const source = await screen.findByRole("button", { name: "Square d5" })

    fireEvent.contextMenu(source, { clientX: 120, clientY: 180 })
    expect(screen.getByRole("dialog", { name: /Phantom options for d5/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Queen \(1 left\)/i }))
    expect(source).toHaveClass("square--phantom")

    fireEvent.contextMenu(source, { clientX: 120, clientY: 180 })
    expect(source).not.toHaveClass("square--phantom")
  })

  it("renders_referee_log_grouped_by_turn", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_log: [
        { turn: 1, color: "white", announcement: "White sees file blocked" },
        { turn: 1, color: "black", announcement: "Black hears no capture" },
        { turn: 2, color: "white", announcement: "White in check" },
      ],
    })

    render(<GamePage />)

    expect(await screen.findByText("Turn 1")).toBeInTheDocument()
    expect(screen.getByText("Turn 2")).toBeInTheDocument()
    expect(screen.getByText("White sees file blocked")).toBeInTheDocument()
    expect(screen.getByText("Black hears no capture")).toBeInTheDocument()
    expect(screen.getByText("White in check")).toBeInTheDocument()
  })

  it("prefers_explicit_referee_turns_from_the_api_when_available", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_turns: [
        { turn: 1, white: ["Move attempt — Move complete"], black: ["Move attempt — Move complete"] },
        { turn: 2, white: ["Move attempt — Move complete"], black: [] },
      ],
      referee_log: [{ turn: 99, color: "white", announcement: "Old fallback log" }],
      engine_state: {
        game_state: {
          white_scoresheet: {
            moves_own: [[[{ question_type: "COMMON", move: "a2a3" }, { main: "REGULAR_MOVE" }]]],
            moves_opponent: [],
          },
        },
      },
    })

    render(<GamePage />)

    expect(await screen.findByText("Turn 1")).toBeInTheDocument()
    expect(screen.getByText("Turn 2")).toBeInTheDocument()
    expect(screen.getAllByText("Move complete").length).toBeGreaterThanOrEqual(3)

    expect(screen.queryByText("Old fallback log")).not.toBeInTheDocument()
    expect(screen.queryByText("a2a3 — Move complete")).not.toBeInTheDocument()
  })

  it("renders_viewer_scoresheet_turns_from_the_api_before_other_log_fallbacks", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      scoresheet: {
        viewer_color: "white",
        last_move_number: 1,
        turns: [
          {
            turn: 1,
            white: [{ message: "Move attempt — Move complete" }],
            black: [{ message: "Opponent move — Capture done at D4 · Check on file" }],
          },
        ],
      },
      referee_turns: [{ turn: 99, white: ["Old turn fallback"], black: [] }],
      referee_log: [{ turn: 99, color: "white", announcement: "Old log fallback" }],
    })

    render(<GamePage />)

    expect(await screen.findByText("Move complete")).toBeInTheDocument()
    expect(screen.getByText("Capture done at D4 · Check on file")).toBeInTheDocument()
    expect(screen.queryByText("Old turn fallback")).not.toBeInTheDocument()
    expect(screen.queryByText("Old log fallback")).not.toBeInTheDocument()
  })

  it("prefers_the_current_players_scoresheet_when_available", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_log: [{ turn: 99, color: "white", announcement: "Old fallback log" }],
      engine_state: {
        game_state: {
          white_scoresheet: {
            moves_own: [
              [
                [{ question_type: "COMMON", move: "e2e4" }, { main: "REGULAR_MOVE" }],
              ],
              [
                [{ question_type: "COMMON", move: "g1f3" }, { main: "ILLEGAL_MOVE" }],
                [{ question_type: "COMMON", move: "f1b5" }, { main: "REGULAR_MOVE", special: "CHECK_FILE" }],
              ],
            ],
            moves_opponent: [
              [
                ["ASK_ANY", { main: "NO_ANY" }],
                ["COMMON", { main: "REGULAR_MOVE" }],
              ],
            ],
          },
        },
      },
    })

    render(<GamePage />)

    expect(await screen.findByText("Turn 1")).toBeInTheDocument()
    expect(screen.getByText("Turn 2")).toBeInTheDocument()
    expect(screen.getByText("[e2e4] Move complete")).toBeInTheDocument()
    expect(screen.getByText("No pawn captures")).toBeInTheDocument()
    expect(screen.getByText("Move complete")).toBeInTheDocument()
    expect(screen.getByText("[g1f3] Illegal move")).toBeInTheDocument()
    expect(screen.getByText("[f1b5] Move complete · Check on file")).toBeInTheDocument()
    expect(screen.getByText(/Check on file/)).toBeInTheDocument()
    expect(screen.queryByText("Old fallback log")).not.toBeInTheDocument()
  })

  it("renders_all_referee_announcements_from_nested_log_payloads", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_log: [
        {
          turn: 1,
          color: "white",
          response: {
            main: "White move accepted",
            extra: ["White gives check", "White hears no capture"],
          },
        },
        {
          turn: 1,
          color: "black",
          announcements: ["Black in check", "Black must respond"],
        },
      ],
    })

    render(<GamePage />)

    expect(await screen.findByText("White move accepted")).toBeInTheDocument()
    expect(screen.getByText("White gives check")).toBeInTheDocument()
    expect(screen.getByText("White hears no capture")).toBeInTheDocument()
    expect(screen.getByText("Black in check")).toBeInTheDocument()
    expect(screen.getByText("Black must respond")).toBeInTheDocument()
  })

  it("deduplicates_repeated_referee_messages_within_a_single_entry", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      scoresheet: {
        viewer_color: "white",
        turns: [
          {
            turn: 1,
            white: [{ move_uci: "e4d5", message: "Capture done at D5", answer: { main: "CAPTURE_DONE", capture_square: "d5" } }],
            black: [
              { message: "Illegal move", answer: { main: "ILLEGAL_MOVE" } },
              { message: "Illegal move", answer: { main: "ILLEGAL_MOVE" } },
              { message: "Illegal move", answer: { main: "ILLEGAL_MOVE" } },
              { message: "Move complete", answer: { main: "REGULAR_MOVE" } },
            ],
          },
        ],
      },
    })

    render(<GamePage />)

    expect(await screen.findByText("[e4d5] Capture done at D5")).toBeInTheDocument()
    expect(screen.queryByText("[e4d5] Capture done at D5 · Capture done at D5")).not.toBeInTheDocument()
    expect(screen.getAllByText("Illegal move")).toHaveLength(3)
    expect(screen.getAllByText("Move complete")).toHaveLength(1)
  })

  it("strips_ask_any_prefixes_and_deduplicates_the_response", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      scoresheet: {
        viewer_color: "white",
        turns: [
          {
            turn: 1,
            white: [{ message: "Ask any pawn captures — Has pawn captures", answer: { main: "HAS_ANY" } }],
            black: [],
          },
        ],
      },
    })

    render(<GamePage />)

    expect(await screen.findByText("Has pawn captures")).toBeInTheDocument()
    expect(screen.queryByText("Ask any pawn captures — Has pawn captures")).not.toBeInTheDocument()
    expect(screen.queryByText("Has pawn captures · Has pawn captures")).not.toBeInTheDocument()
  })

  it("formats_structured_referee_status_codes_into_friendly_text", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_log: [
        {
          turn: 1,
          color: "white",
          answer: {
            main: "ILLEGAL_MOVE",
          },
        },
        {
          turn: 1,
          color: "black",
          answer: {
            main: 2,
          },
        },
        {
          turn: 2,
          color: "white",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "c6",
          },
        },
        {
          turn: 2,
          color: "black",
          answer: {
            main: 4,
          },
        },
        {
          turn: 3,
          color: "white",
          answer: {
            main: "5",
          },
        },
      ],
    })

    render(<GamePage />)

    expect(await screen.findByText("Illegal move")).toBeInTheDocument()
    expect(screen.getByText("Move complete")).toBeInTheDocument()
    expect(screen.getByText("Capture done at C6")).toBeInTheDocument()
    expect(screen.getByText("Has pawn captures")).toBeInTheDocument()
    expect(screen.getByText("No pawn captures")).toBeInTheDocument()
    expect(screen.queryByText("ILLEGAL_MOVE")).not.toBeInTheDocument()
    expect(screen.queryByText("CAPTURE_DONE")).not.toBeInTheDocument()
  })

  it("highlights_the_recent_capture_square_on_the_board", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_log: [
        {
          turn: 1,
          color: "white",
          answer: {
            main: "CAPTURE_DONE",
            capture_square: "c6",
          },
        },
      ],
    })

    render(<GamePage />)

    await screen.findByText("Capture done at C6")
    expect(screen.getAllByRole("button", { name: "Square c6" }).at(-1)).toHaveClass("square--capture")
    expect(screen.getAllByRole("button", { name: "Square c5" }).at(-1)).not.toHaveClass("square--capture")
  })

  it("formats_special_referee_announcements_into_friendly_text", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      referee_log: [
        { turn: 1, color: "white", announcement: "CHECK_RANK" },
        { turn: 1, color: "black", announcement: "CHECK_FILE" },
        { turn: 2, color: "white", announcement: "CHECK_LONG_DIAGONAL" },
        { turn: 2, color: "black", announcement: "CHECK_SHORT_DIAGONAL" },
        { turn: 3, color: "white", announcement: "CHECK_KNIGHT" },
        { turn: 3, color: "black", announcement: "CHECK_DOUBLE" },
        { turn: 4, color: "white", announcement: "DRAW_TOOMANYREVERSIBLEMOVES" },
        { turn: 4, color: "black", announcement: "DRAW_STALEMATE" },
        { turn: 5, color: "white", announcement: "DRAW_INSUFFICIENT" },
        { turn: 5, color: "black", announcement: "CHECKMATE_WHITE_WINS" },
        { turn: 6, color: "white", announcement: "CHECKMATE_BLACK_WINS" },
      ],
    })

    render(<GamePage />)

    expect(await screen.findByText("Check on rank")).toBeInTheDocument()
    expect(screen.getByText("Check on file")).toBeInTheDocument()
    expect(screen.getByText("Check on long diagonal")).toBeInTheDocument()
    expect(screen.getByText("Check on short diagonal")).toBeInTheDocument()
    expect(screen.getByText("Check by knight")).toBeInTheDocument()
    expect(screen.getByText("Double check")).toBeInTheDocument()
    expect(screen.getByText("Draw by too many reversible moves")).toBeInTheDocument()
    expect(screen.getByText("Draw by stalemate")).toBeInTheDocument()
    expect(screen.getByText("Draw by insufficient material")).toBeInTheDocument()
    expect(screen.getByText("Checkmate — White wins")).toBeInTheDocument()
    expect(screen.getByText("Checkmate — Black wins")).toBeInTheDocument()
  })

  it("does_not_mark_the_whole_game_page_as_a_live_region", async () => {
    const { container } = render(<GamePage />)

    await screen.findByText(/Game ID:/i)
    expect(container.querySelector("main.game-page")).not.toHaveAttribute("aria-live")
  })

  it("asks_the_referee_and_repolls", async () => {
    render(<GamePage />)

    const askButton = await screen.findByRole("button", { name: "Any pawn captures?" })
    fireEvent.click(askButton)

    await waitFor(() => {
      expect(mockApi.askAny).toHaveBeenCalledWith("g-123")
      expect(mockApi.getGameState).toHaveBeenCalledTimes(2)
    })
  })

  it("clears_stale_move_highlights_after_ask_any_repolls_the_legal_moves", async () => {
    mockApi.getGameState
      .mockResolvedValueOnce({
        ...activeState,
        your_fen: "8/8/8/8/8/8/8/4K3",
        allowed_moves: ["e4d5"],
      })
      .mockResolvedValueOnce({
        ...activeState,
        your_fen: "8/8/8/8/8/8/8/4K3",
        allowed_moves: ["a2a3"],
      })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")

    fireEvent.click(screen.getByRole("button", { name: "Any pawn captures?" }))

    await waitFor(() => {
      expect(mockApi.askAny).toHaveBeenCalledWith("g-123")
      expect(mockApi.getGameState).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByRole("button", { name: "Square e4" })).not.toHaveClass("square--highlighted")
    expect(screen.getByRole("button", { name: "Square d5" })).not.toHaveClass("square--suggested")
  })

  it("reduces_a_hidden_midfield_pawn_to_only_non_capture_moves_after_no_any", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4e5", "e4f5"],
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).toHaveClass("square--suggested")

    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4e5"],
      referee_log: [{ turn: 1, color: "white", announcement: "No pawn captures" }],
    })

    fireEvent.click(screen.getByRole("button", { name: "Any pawn captures?" }))

    await waitFor(() => expect(mockApi.getGameState).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    expect(screen.getByRole("button", { name: "Square e5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square d5" })).not.toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).not.toHaveClass("square--suggested")
  })

  it("reduces_a_hidden_midfield_pawn_to_only_capture_moves_after_has_any", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4e5", "e4f5"],
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).toHaveClass("square--suggested")

    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4f5"],
      referee_log: [{ turn: 1, color: "white", announcement: "Has pawn captures" }],
    })

    fireEvent.click(screen.getByRole("button", { name: "Any pawn captures?" }))

    await waitFor(() => expect(mockApi.getGameState).toHaveBeenCalledTimes(2))

    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e5" })).not.toHaveClass("square--suggested")
  })

  it("locally_filters_hidden_midfield_pawn_targets_after_no_any_even_if_allowed_moves_are_stale", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4e5", "e4f5"],
      scoresheet: {
        turns: [
          {
            turn: 1,
            white: [{ prompt: "Ask any pawn captures", messages: ["No pawn captures"] }],
            black: [],
          },
        ],
      },
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    expect(screen.getByRole("button", { name: "Square e5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square d5" })).not.toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).not.toHaveClass("square--suggested")
  })

  it("locally_filters_message_only_no_any_entries_without_prompt_metadata", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      move_number: 1,
      your_fen: "8/8/8/8/8/8/PPPPPPPP/4K3",
      allowed_moves: ["e2d3", "e2e3", "e2e4", "e2f3"],
      scoresheet: {
        turns: [
          {
            turn: 1,
            white: [{ messages: ["No pawn captures"] }],
            black: [],
          },
        ],
      },
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e2" })
    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))

    expect(screen.getByRole("button", { name: "Square e3" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square d3" })).not.toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f3" })).not.toHaveClass("square--suggested")
  })

  it("locally_filters_hidden_midfield_pawn_targets_after_has_any_even_if_allowed_moves_are_stale", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4e5", "e4f5"],
      scoresheet: {
        turns: [
          {
            turn: 1,
            white: [{ prompt: "Ask any pawn captures", messages: ["Has pawn captures"] }],
            black: [],
          },
        ],
      },
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e5" })).not.toHaveClass("square--suggested")
  })

  it("does_not_apply_an_old_no_any_constraint_to_a_later_turn", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      move_number: 3,
      your_fen: "8/8/8/8/8/8/8/4K3",
      allowed_moves: ["e4d5", "e4e5", "e4f5"],
      scoresheet: {
        turns: [
          {
            turn: 1,
            white: [{ prompt: "Ask any pawn captures", messages: ["No pawn captures"] }],
            black: [],
          },
        ],
      },
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e4" })
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))

    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e5" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square f5" })).toHaveClass("square--suggested")
  })

  it("applies_no_any_constraint_on_black_turns_using_turn_number_not_halfmove_number", async () => {
    mockApi.getGame.mockResolvedValueOnce({
      game_id: "g-123",
      game_code: "ABC123",
      rule_variant: "berkeley_any",
      state: "active",
      opponent_type: "user",
      white: { username: "fil", role: "user", connected: true },
      black: { username: "gptnano", role: "bot", connected: true },
      turn: "black",
      move_number: 2,
      created_at: "2026-04-02T12:00:00Z",
    })
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      turn: "black",
      move_number: 2,
      your_color: "black",
      your_fen: "8/8/8/3p4/8/8/8/4k3",
      allowed_moves: ["d5c4", "d5d4", "d5e4"],
      possible_actions: ["move", "ask_any"],
      scoresheet: {
        turns: [
          {
            turn: 1,
            white: [],
            black: [{ messages: ["No pawn captures"] }],
          },
        ],
      },
    })

    render(<GamePage />)

    await screen.findByRole("button", { name: "Square d5" })
    fireEvent.click(screen.getByRole("button", { name: "Square d5" }))

    expect(screen.getByRole("button", { name: "Square d4" })).toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square c4" })).not.toHaveClass("square--suggested")
    expect(screen.getByRole("button", { name: "Square e4" })).not.toHaveClass("square--suggested")
  })

  it("disables_ask_any_when_not_allowed", async () => {
    mockApi.getGameState.mockResolvedValueOnce({ ...activeState, possible_actions: ["move"] })

    render(<GamePage />)

    const askButton = await screen.findByRole("button", { name: "Any pawn captures?" })
    expect(askButton).toBeDisabled()
  })

  it("stops_polling_when_game_completed", async () => {
    mockApi.getGameState.mockResolvedValueOnce({ ...activeState, state: "completed", possible_actions: [] })

    render(<GamePage />)

    await screen.findByText(/State:/i)
    await sleep(650)

    expect(mockApi.getGameState).toHaveBeenCalledTimes(1)
  })
})
