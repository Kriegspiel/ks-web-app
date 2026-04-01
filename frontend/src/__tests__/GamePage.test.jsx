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
  your_fen: "8/8/8/8/8/8/8/8",
  referee_log: [{ announcement: "White to move" }],
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
  it("polls_every_2s_while_active", async () => {
    render(<GamePage />)

    await screen.findByText(/Game ID:/i)
    expect(mockApi.getGameState).toHaveBeenCalledTimes(1)

    await sleep(2200)
    await waitFor(() => expect(mockApi.getGameState).toHaveBeenCalledTimes(2))
  })

  it("submits_two_click_move_and_repolls", async () => {
    render(<GamePage />)

    await screen.findByRole("button", { name: "Square e2" })

    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit move" }))

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
    fireEvent.click(screen.getByRole("button", { name: "Submit move" }))

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
  })

  it.skip("supports_right_button_drag_for_phantoms_without_opening_the_menu", async () => {
    render(<GamePage />)

    const source = await screen.findByRole("button", { name: "Square d5" })
    const target = screen.getByRole("button", { name: "Square e4" })

    fireEvent.contextMenu(source)
    fireEvent.click(screen.getByRole("button", { name: /Queen \(1 left\)/i }))
    expect(source).toHaveClass("square--phantom")

    const originalElementFromPoint = document.elementFromPoint
    document.elementFromPoint = vi.fn(() => target)

    fireEvent.pointerDown(source, { button: 2, buttons: 2, pointerId: 9, pointerType: "mouse" })
    fireEvent.pointerEnter(target, { button: 2, buttons: 2, pointerId: 9, pointerType: "mouse" })
    fireEvent.pointerMove(source, { button: 2, buttons: 2, pointerId: 9, pointerType: "mouse", clientX: 290, clientY: 330 })
    fireEvent.pointerUp(target, { button: 2, buttons: 0, pointerId: 9, pointerType: "mouse", clientX: 290, clientY: 330 })
    fireEvent.contextMenu(target)

    document.elementFromPoint = originalElementFromPoint

    expect(target).toHaveClass("square--phantom")
    expect(source).not.toHaveClass("square--phantom")
    expect(screen.queryByRole("dialog", { name: /Phantom options for e4/i })).not.toBeInTheDocument()
  })

  it("supports_phantom_add_move_delete_via_context_menu", async () => {
    render(<GamePage />)

    await screen.findByRole("button", { name: "Square d5" })

    fireEvent.contextMenu(screen.getByRole("button", { name: "Square d5" }), { clientX: 120, clientY: 180 })
    expect(screen.getByRole("dialog", { name: /Phantom options for d5/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Queen \(1 left\)/i }))
    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--phantom")

    fireEvent.contextMenu(screen.getByRole("button", { name: "Square d5" }), { clientX: 120, clientY: 180 })
    fireEvent.click(screen.getByRole("button", { name: "Right-drag to move" }))
    expect(screen.getByText(/Moving phantom from/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    expect(screen.getByRole("button", { name: "Square e4" })).toHaveClass("square--phantom")

    fireEvent.contextMenu(screen.getByRole("button", { name: "Square e4" }), { clientX: 120, clientY: 180 })
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(screen.getByRole("button", { name: "Square e4" })).not.toHaveClass("square--phantom")
  })

  it("disables_ask_any_when_not_allowed", async () => {
    mockApi.getGameState.mockResolvedValueOnce({ ...activeState, possible_actions: ["move"] })

    render(<GamePage />)

    const askButton = await screen.findByRole("button", { name: "Ask any captures?" })
    expect(askButton).toBeDisabled()
  })

  it("stops_polling_when_game_completed", async () => {
    mockApi.getGameState.mockResolvedValueOnce({ ...activeState, state: "completed", possible_actions: [] })

    render(<GamePage />)

    await screen.findByText(/State:/i)
    await sleep(2200)

    expect(mockApi.getGameState).toHaveBeenCalledTimes(1)
  })
})
