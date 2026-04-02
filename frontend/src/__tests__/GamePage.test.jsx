import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import GamePage from "../pages/GamePage"

const mockNavigate = vi.hoisted(() => vi.fn())

const mockApi = vi.hoisted(() => ({
  getGameState: vi.fn(),
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
  referee_log: [{ turn: 1, color: "white", announcement: "White to move" }],
  possible_actions: ["move", "ask_any"],
  clock: { white_remaining: 601, black_remaining: 598, active_color: "white" },
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

beforeEach(() => {
  window.localStorage.clear()
  mockNavigate.mockReset()
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getGameState.mockResolvedValue(activeState)
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
      expect(mockApi.getGameState).toHaveBeenCalledTimes(2)
    })

    expect(screen.getByRole("button", { name: "Square e2" })).toHaveClass("square--last-move")
    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--last-move")
  })

  it("gates_promotion_with_modal_and_appends_suffix", async () => {
    mockApi.getGameState.mockResolvedValueOnce({
      ...activeState,
      your_fen: "8/P7/8/8/8/8/8/8",
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
    expect(screen.getAllByText("Move attempt — Move complete").length).toBeGreaterThanOrEqual(3)

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

    expect(await screen.findByText("Move attempt — Move complete")).toBeInTheDocument()
    expect(screen.getByText("Opponent move — Capture done at D4 · Check on file")).toBeInTheDocument()
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
    expect(screen.getByText("Move attempt — Move complete")).toBeInTheDocument()
    expect(screen.getByText("Opponent asked any pawn captures — No pawn captures")).toBeInTheDocument()
    expect(screen.getByText("Opponent move — Move complete")).toBeInTheDocument()
    expect(screen.getByText("Move attempt — Illegal move")).toBeInTheDocument()
    expect(screen.getAllByText(/Move attempt — /).length).toBeGreaterThanOrEqual(3)
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
