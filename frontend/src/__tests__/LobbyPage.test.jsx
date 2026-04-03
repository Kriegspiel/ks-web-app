import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import LobbyPage from "../pages/LobbyPage"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockApi = vi.hoisted(() => ({ createGame: vi.fn(), joinGame: vi.fn(), getOpenGames: vi.fn(), getMyGames: vi.fn(), getGame: vi.fn(), getBots: vi.fn() }))
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => mockNavigate }))
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { username: "fil" }, actionError: "" }) }))
vi.mock("../services/api", () => mockApi)

beforeEach(() => { mockNavigate.mockReset(); Object.values(mockApi).forEach((fn) => fn.mockReset()); mockApi.getOpenGames.mockResolvedValue({ games: [] }); mockApi.getMyGames.mockResolvedValue({ games: [] }); mockApi.getGame.mockResolvedValue({ state: "waiting" }); mockApi.getBots.mockResolvedValue({ bots: [{ bot_id: "bot-1", username: "randobot", display_name: "Random Bot", description: "Plays random legal-looking moves", elo: 1201 }, { bot_id: "bot-2", username: "gptnano", display_name: "GPT Nano", description: "Model-driven Kriegspiel bot that chooses moves using GPT nano model.", elo: 1342 }] }) })
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("LobbyPage", () => {
  it("shows_lobby_version_badge", async () => {
    render(<LobbyPage />)

    expect(await screen.findAllByText("v. 1.1.7 / v. 1.0.0")).toHaveLength(1)
  })

  it("creates_waiting_game_and_shows_join_code", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-1", game_code: "ABCD23", state: "waiting" })
    render(<LobbyPage />)
    fireEvent.change(await screen.findByLabelText("Ruleset"), { target: { value: "berkeley" } })
    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))
    await screen.findByText("Join code:")
    expect(screen.getByText("ABCD23")).toBeInTheDocument()
    expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({ opponent_type: "human", bot_id: undefined, rule_variant: "berkeley" }))
  })

  it("shows_bot_picker_and_creates_bot_game", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-bot-1", game_code: "BOT123", state: "active", opponent_type: "bot", bot: { bot_id: "bot-1", username: "randobot" } })
    render(<LobbyPage />)
    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByLabelText("Bot opponent")).toBeInTheDocument()
    expect(screen.getByText("Plays random legal-looking moves.")).toBeInTheDocument()
    expect(screen.getByLabelText("Bot opponent")).toHaveValue("bot-1")
    expect(screen.getByRole("option", { name: "Random Bot (1201)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "GPT Nano (1342)" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Create bot game" }))
    await waitFor(() => expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({ opponent_type: "bot", bot_id: "bot-1" })))
    expect(mockNavigate).toHaveBeenCalledWith("/game/g-bot-1")
  })
})
