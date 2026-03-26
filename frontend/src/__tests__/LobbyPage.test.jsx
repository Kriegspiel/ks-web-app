import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import LobbyPage from "../pages/LobbyPage"

const mockNavigate = vi.hoisted(() => vi.fn())

const mockApi = vi.hoisted(() => ({
  createGame: vi.fn(),
  joinGame: vi.fn(),
  getOpenGames: vi.fn(),
  getMyGames: vi.fn(),
  getGame: vi.fn(),
}))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ user: { username: "fil" }, actionError: "" }),
}))

vi.mock("../services/api", () => mockApi)

beforeEach(() => {
  mockNavigate.mockReset()
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getOpenGames.mockResolvedValue({ games: [] })
  mockApi.getMyGames.mockResolvedValue({ games: [] })
  mockApi.getGame.mockResolvedValue({ state: "waiting" })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("LobbyPage", () => {
  it("creates_waiting_game_and_shows_join_code", async () => {
    mockApi.createGame.mockResolvedValue({
      game_id: "g-1",
      game_code: "ABCD23",
      state: "waiting",
    })

    render(<LobbyPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    await screen.findByText("Join code:")
    expect(screen.getByText("ABCD23")).toBeInTheDocument()
    expect(screen.getByText("Waiting for opponent…")).toBeInTheDocument()
    expect(mockApi.createGame).toHaveBeenCalledTimes(1)
  })

  it("joins_by_code_and_navigates_to_game", async () => {
    mockApi.joinGame.mockResolvedValue({ game_id: "g-join-1" })

    render(<LobbyPage />)

    fireEvent.change(await screen.findByLabelText("Game code"), { target: { value: "abc123" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("ABC123")
      expect(mockNavigate).toHaveBeenCalledWith("/game/g-join-1")
    })
  })

  it("shows_join_error_message_for_failed_join", async () => {
    mockApi.joinGame.mockRejectedValue({ message: "Game is already full." })

    render(<LobbyPage />)

    fireEvent.change(await screen.findByLabelText("Game code"), { target: { value: "ABC123" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await screen.findByText("Game is already full.")
  })

  it("polls_waiting_game_and_redirects_when_active", async () => {
    mockApi.createGame.mockResolvedValue({
      game_id: "g-2",
      game_code: "QWER56",
      state: "waiting",
    })
    mockApi.getGame.mockResolvedValueOnce({ state: "active" })

    render(<LobbyPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/game/g-2")
    })
  })

  it("open_and_mine_rows_provide_actions", async () => {
    mockApi.getOpenGames.mockResolvedValue({
      games: [{ game_code: "ZXCV89", created_by: "alice", available_color: "black", created_at: "2026-01-01T10:00:00Z" }],
    })
    mockApi.getMyGames.mockResolvedValue({
      games: [{ game_id: "mine-1", game_code: "MINE01", state: "active", move_number: 3, white: { username: "fil" }, black: { username: "alice" } }],
    })
    mockApi.joinGame.mockResolvedValue({ game_id: "joined-open-1" })

    render(<LobbyPage />)

    fireEvent.click(await screen.findByRole("button", { name: "Join" }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/game/joined-open-1"))

    fireEvent.click(screen.getByRole("button", { name: "Open" }))
    expect(mockNavigate).toHaveBeenCalledWith("/game/mine-1")
  })
})
