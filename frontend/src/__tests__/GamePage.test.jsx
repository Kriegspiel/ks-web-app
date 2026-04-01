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
