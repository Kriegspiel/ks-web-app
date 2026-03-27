import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
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

    await screen.findByText(/Game ID:/i)

    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit move" }))

    await waitFor(() => {
      expect(mockApi.submitMove).toHaveBeenCalledWith("g-123", "e2e4")
      expect(mockApi.getGameState).toHaveBeenCalledTimes(2)
    })
  })

  it("supports_phantom_place_remove_and_keeps_api_payload_clean", async () => {
    render(<GamePage />)

    await screen.findByText(/Game ID:/i)

    fireEvent.click(screen.getByRole("button", { name: /Q × 1/i }))
    fireEvent.click(screen.getByRole("button", { name: "Square d5" }))

    expect(screen.getByRole("button", { name: "Square d5" })).toHaveClass("square--phantom")

    fireEvent.click(screen.getByRole("button", { name: /Q × 0/i }))
    fireEvent.click(screen.getByRole("button", { name: "Square e2" }))
    fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
    fireEvent.click(screen.getByRole("button", { name: "Submit move" }))

    await waitFor(() => {
      expect(mockApi.submitMove).toHaveBeenCalledWith("g-123", "e2e4")
    })

    fireEvent.contextMenu(screen.getByRole("button", { name: "Square d5" }))
    expect(screen.getByRole("button", { name: "Square d5" })).not.toHaveClass("square--phantom")
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
