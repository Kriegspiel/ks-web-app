import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import LobbyPage from "../pages/LobbyPage"
import { TEST_VERSION_STAMP } from "../version"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockApi = vi.hoisted(() => ({ createGame: vi.fn(), deleteWaitingGame: vi.fn(), joinGame: vi.fn(), getOpenGames: vi.fn(), getMyGames: vi.fn(), getGame: vi.fn(), getBots: vi.fn(), getLobbyStats: vi.fn() }))
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => mockNavigate }))
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { username: "fil" }, actionError: "" }) }))
vi.mock("../services/api", () => mockApi)

beforeEach(() => { mockNavigate.mockReset(); Object.values(mockApi).forEach((fn) => fn.mockReset()); mockApi.getOpenGames.mockResolvedValue({ games: [] }); mockApi.getMyGames.mockResolvedValue({ games: [] }); mockApi.getLobbyStats.mockResolvedValue({ active_games_now: 12, completed_last_hour: 3, completed_last_24_hours: 42, completed_total: 314 }); mockApi.getGame.mockResolvedValue({ state: "waiting" }); mockApi.deleteWaitingGame.mockResolvedValue({}); mockApi.getBots.mockResolvedValue({ bots: [{ bot_id: "bot-1", username: "randobot", display_name: "Random Bot", description: "Plays random legal-looking moves", elo: 1201, supported_rule_variants: ["berkeley", "berkeley_any"] }, { bot_id: "bot-2", username: "gptnano", display_name: "GPT Nano", description: "Model-driven Kriegspiel bot that chooses moves using GPT nano model.", elo: 1342, supported_rule_variants: ["berkeley", "berkeley_any"] }, { bot_id: "bot-3", username: "randobotany", display_name: "Random Any Bot", description: "Asks any pawn captures first, then plays random legal-looking moves.", elo: 1200, supported_rule_variants: ["berkeley_any"] }] }) })
afterEach(() => { cleanup(); vi.useRealTimers() })

function renderPage() {
  render(
    <MemoryRouter>
      <LobbyPage />
    </MemoryRouter>,
  )
}

describe("LobbyPage", () => {
  it("shows_lobby_version_badge", async () => {
    renderPage()

    expect(await screen.findAllByText(TEST_VERSION_STAMP)).toHaveLength(1)

  })

  it("shows_lobby_quick_actions", async () => {
    mockApi.getMyGames.mockResolvedValue({
      games: [
        {
          game_id: "g-active",
          game_code: "LIVE01",
          state: "active",
          move_number: 8,
          white: { username: "fil", role: "user" },
          black: { username: "randobot", role: "bot" },
        },
      ],
    })

    renderPage()

    expect(await screen.findByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/g-active")
    expect(screen.getByRole("link", { name: "Leaderboard" })).toHaveAttribute("href", "/leaderboard")
    expect(screen.getByRole("link", { name: /Read rules/i })).toHaveAttribute("href", "https://kriegspiel.org/rules")
  })

  it("hides_resume_active_game_when_user_has_no_active_game", async () => {
    renderPage()

    await screen.findByRole("link", { name: "Leaderboard" })
    expect(screen.queryByRole("link", { name: "Resume active game" })).not.toBeInTheDocument()
  })

  it("orders_join_sections_as_create_open_join", async () => {
    renderPage()

    const headings = await screen.findAllByRole("heading", { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Create game",
      "Open games",
      "Join by code",
      "Lobby stats",
      "My games",
    ])
  })

  it("shows_lobby_stats_between_join_and_my_games", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Lobby stats" })).toBeInTheDocument()
    expect(await screen.findByText("12")).toBeInTheDocument()
    expect(screen.getByText("Active games now")).toBeInTheDocument()
    expect(screen.getByText("Completed last hour")).toBeInTheDocument()
    expect(screen.getByText("Completed last 24 hours")).toBeInTheDocument()
    expect(screen.getByText("Completed total")).toBeInTheDocument()
  })

  it("formats_open_game_dates_in_utc", async () => {
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_code: "ABCD23",
          created_by: "randobotany",
          available_color: "black",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    expect(await screen.findByRole("link", { name: "randobotany (bot)" })).toHaveAttribute("href", "/user/randobotany")
    expect(await screen.findByText(/2026-04-03 23:59:59 UTC/)).toBeInTheDocument()
  })

  it("shows_close_for_my_open_waiting_game", async () => {
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_id: "g-open-own",
          game_code: "OWN123",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("g-open-own")
    })
  })

  it("creates_waiting_game_and_shows_join_code", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-1", game_code: "ABCD23", state: "waiting" })
    renderPage()
    fireEvent.change(await screen.findByLabelText("Ruleset"), { target: { value: "berkeley" } })
    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))
    await screen.findByText("Join code:")
    expect(screen.getByText("ABCD23")).toBeInTheDocument()
    expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({ opponent_type: "human", bot_id: undefined, rule_variant: "berkeley" }))
  })

  it("closes_the_created_waiting_game", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-1", game_code: "ABCD23", state: "waiting" })
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))
    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("g-1")
    })
  })

  it("shows_profile_links_and_bot_labels_in_my_games", async () => {
    mockApi.getMyGames.mockResolvedValue({
      games: [
        {
          game_id: "g-1",
          game_code: "M6QNCP",
          state: "completed",
          move_number: 16,
          white: { username: "randobot", role: "bot" },
          black: { username: "fil", role: "user" },
        },
      ],
    })

    renderPage()

    expect(await screen.findByRole("link", { name: "randobot (bot)" })).toHaveAttribute("href", "/user/randobot")
    expect(screen.getByRole("link", { name: "fil" })).toHaveAttribute("href", "/user/fil")
    expect(screen.getByText(/completed · move 16/i)).toBeInTheDocument()
  })

  it("shows_close_for_waiting_games_in_my_games", async () => {
    mockApi.getMyGames.mockResolvedValue({
      games: [
        {
          game_id: "g-waiting",
          game_code: "WAIT01",
          state: "waiting",
          move_number: 0,
          white: { username: "fil", role: "user" },
          black: null,
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("g-waiting")
    })
  })

  it("shows_bot_picker_and_creates_bot_game", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-bot-1", game_code: "BOT123", state: "active", opponent_type: "bot", bot: { bot_id: "bot-1", username: "randobot" } })
    renderPage()
    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByLabelText("Bot opponent")).toBeInTheDocument()
    expect(screen.getByText("Plays random legal-looking moves.")).toBeInTheDocument()
    expect(screen.getByLabelText("Bot opponent")).toHaveValue("bot-1")
    expect(screen.getByRole("option", { name: "Random Bot (1201)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "GPT Nano (1342)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Random Any Bot (1200)" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Create bot game" }))
    await waitFor(() => expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({ opponent_type: "bot", bot_id: "bot-1" })))
    expect(mockNavigate).toHaveBeenCalledWith("/game/g-bot-1")
  })

  it("filters_unsupported_bots_for_selected_ruleset", async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText("Ruleset"), { target: { value: "berkeley" } })
    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByLabelText("Bot opponent")).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Random Any Bot (1200)" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Random Bot (1201)" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "GPT Nano (1342)" })).toBeInTheDocument()
  })
})
