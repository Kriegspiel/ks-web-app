import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import LobbyPage from "../pages/LobbyPage"
import { TEST_VERSION_STAMP } from "../version"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockApi = vi.hoisted(() => ({ createGame: vi.fn(), deleteWaitingGame: vi.fn(), joinGame: vi.fn(), getOpenGames: vi.fn(), getMyGames: vi.fn(), getGame: vi.fn(), getBots: vi.fn(), getLobbyStats: vi.fn() }))
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => mockNavigate }))
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { username: "fil" }, actionError: "" }) }))
vi.mock("../services/api", () => mockApi)

beforeEach(() => { mockNavigate.mockReset(); Object.values(mockApi).forEach((fn) => fn.mockReset()); mockApi.getOpenGames.mockResolvedValue({ games: [] }); mockApi.getMyGames.mockResolvedValue({ games: [] }); mockApi.getLobbyStats.mockResolvedValue({ active_games_now: 123456789, completed_last_hour: 3, completed_last_24_hours: 42, completed_total: 314 }); mockApi.getGame.mockResolvedValue({ state: "waiting" }); mockApi.deleteWaitingGame.mockResolvedValue({}); mockApi.getBots.mockResolvedValue({ bots: [{ bot_id: "bot-1", username: "randobot", display_name: "Random Bot", description: "Plays random legal-looking moves", elo: 1201, supported_rule_variants: ["berkeley", "berkeley_any"] }, { bot_id: "bot-2", username: "gptnano", display_name: "GPT Nano", description: "Model-driven Kriegspiel bot that chooses moves using GPT nano model.", elo: 1342, supported_rule_variants: ["berkeley", "berkeley_any"] }, { bot_id: "bot-3", username: "randobotany", display_name: "Random Any Bot", description: "Asks any pawn captures first, then plays random legal-looking moves.", elo: 1200, supported_rule_variants: ["berkeley_any"] }] }) })
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

    expect(await screen.findByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/LIVE01")
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
    ])
  })

  it("shows_lobby_stats_after_join_by_code", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Lobby stats" })).toBeInTheDocument()
    expect(await screen.findByText("123,456,789")).toBeInTheDocument()
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
          game_code: "OWN123",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Open" }))

    expect(mockNavigate).toHaveBeenCalledWith("/game/OWN123")

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("OWN123")
    })
  })

  it("keeps_my_open_games_at_the_top_of_open_games", async () => {
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_id: "g-open-other",
          game_code: "ZZZ999",
          created_by: "randobot",
          available_color: "black",
          created_at: "2026-04-03T23:59:58Z",
        },
        {
          game_code: "OWN123",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    const openGames = await screen.findAllByRole("listitem")
    expect(within(openGames[0]).getByText("OWN123")).toBeInTheDocument()
    expect(within(openGames[0]).getByRole("button", { name: "Open" })).toBeInTheDocument()
    expect(within(openGames[0]).getByRole("button", { name: "Close" })).toBeInTheDocument()
    expect(within(openGames[1]).getByText("ZZZ999")).toBeInTheDocument()
    expect(within(openGames[1]).getByRole("button", { name: "Join" })).toBeInTheDocument()
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
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("ABCD23")
    })
  })

  it("clears_created_waiting_card_when_same_game_is_closed_from_open_games", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-1", game_code: "OWN123", state: "waiting" })
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_code: "OWN123",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))
    await screen.findByText("Join code:")
    fireEvent.click((await screen.findAllByRole("button", { name: "Close" }))[1])

    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("OWN123")
    })
    await waitFor(() => {
      expect(screen.queryByText("Join code:")).not.toBeInTheDocument()
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
    expect(mockNavigate).toHaveBeenCalledWith("/game/BOT123")
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

  it("opens_my_own_waiting_game_when_join_by_code_hits_own_game_conflict", async () => {
    mockApi.joinGame.mockRejectedValue({ status: 409, code: "CANNOT_JOIN_OWN_GAME", message: "You cannot join your own waiting game." })

    renderPage()

    fireEvent.change(await screen.findByLabelText("Game code"), { target: { value: "own123" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("OWN123")
      expect(mockNavigate).toHaveBeenCalledWith("/game/OWN123")
    })
  })

  it("shows_an_error_when_no_supported_bot_is_available_for_the_selected_ruleset", async () => {
    mockApi.getBots.mockResolvedValue({
      bots: [
        {
          bot_id: "bot-only-any",
          username: "randobotany",
          display_name: "Random Any Bot",
          description: "Asks any pawn captures first.",
          elo: 1200,
          supported_rule_variants: ["berkeley_any"],
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))
    await screen.findByLabelText("Bot opponent")
    fireEvent.change(screen.getByLabelText("Ruleset"), { target: { value: "berkeley" } })
    fireEvent.change(screen.getByLabelText("Bot opponent"), { target: { value: "" } })
    fireEvent.click(screen.getByRole("button", { name: "Create bot game" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Pick a bot before creating the game.")
  })

  it("surfaces_create_errors_when_game_creation_fails", async () => {
    mockApi.createGame.mockRejectedValueOnce({ message: "Create exploded" })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Create exploded")
  })

  it("validates_blank_join_codes_and_surfaces_join_errors", async () => {
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Join game" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a game code to join.")

    mockApi.joinGame.mockRejectedValueOnce({ message: "Join failed" })
    fireEvent.change(screen.getByLabelText("Game code"), { target: { value: "fail01" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("FAIL01")
    })
    expect(await screen.findByRole("alert")).toHaveTextContent("Join failed")
  })

  it("handles_open_game_join_conflicts_and_failures", async () => {
    mockApi.getOpenGames.mockResolvedValueOnce({
      games: [
        {
          game_code: "ZZZ999",
          created_by: "randobot",
          available_color: "black",
          created_at: "2026-04-03T23:59:58Z",
        },
      ],
    })
    mockApi.joinGame
      .mockRejectedValueOnce({ status: 409, code: "CANNOT_JOIN_OWN_GAME", message: "Open your own waiting game." })
      .mockRejectedValueOnce({ message: "Open join failed" })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Join" }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/game/ZZZ999")
    })

    fireEvent.click(screen.getByRole("button", { name: "Join" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Open join failed")
  })

  it("polls_a_created_waiting_game_until_it_becomes_active", async () => {
    mockApi.createGame.mockResolvedValueOnce({ game_id: "g-1", game_code: "ABCD23", state: "waiting" })
    mockApi.getGame.mockResolvedValueOnce({ state: "active", game_code: "ABCD23" })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    await waitFor(() => {
      expect(mockApi.getGame).toHaveBeenCalledWith("g-1")
      expect(mockNavigate).toHaveBeenCalledWith("/game/ABCD23")
    })
  })

  it("shows_an_error_when_closing_a_waiting_game_fails", async () => {
    mockApi.getOpenGames.mockResolvedValueOnce({
      games: [
        {
          game_code: "OWN123",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })
    mockApi.deleteWaitingGame.mockRejectedValueOnce({ message: "Close failed" })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Close failed")
  })
})
