import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import LobbyPage from "../pages/LobbyPage"
import { TEST_VERSION_STAMP } from "../version"

const mockNavigate = vi.hoisted(() => vi.fn())
const mockAuth = vi.hoisted(() => ({
  user: { username: "fil" },
  actionError: "",
}))
const mockApi = vi.hoisted(() => ({ createGame: vi.fn(), deleteWaitingGame: vi.fn(), joinGame: vi.fn(), getOpenGames: vi.fn(), getMyGames: vi.fn(), getGame: vi.fn(), getBots: vi.fn(), getLobbyStats: vi.fn() }))
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => mockNavigate }))
vi.mock("../hooks/useAuth", () => ({ useAuth: () => mockAuth }))
vi.mock("../services/api", () => mockApi)

beforeEach(() => {
  mockNavigate.mockReset()
  mockAuth.user = { username: "fil" }
  mockAuth.actionError = ""
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getOpenGames.mockResolvedValue({ games: [] })
  mockApi.getMyGames.mockResolvedValue({ games: [] })
  mockApi.getLobbyStats.mockResolvedValue({ active_games_now: 123456789, completed_last_hour: 3, completed_last_24_hours: 42, completed_total: 314 })
  mockApi.getGame.mockResolvedValue({ state: "waiting" })
  mockApi.deleteWaitingGame.mockResolvedValue({})
  mockApi.getBots.mockResolvedValue({ bots: [{ bot_id: "bot-1", username: "randobot", display_name: "Random Bot", description: "Plays random legal-looking moves", elo: 1201, supported_rule_variants: ["berkeley", "berkeley_any"] }, { bot_id: "bot-2", username: "gptnano", display_name: "GPT Nano", description: "Model-driven Kriegspiel bot that chooses moves using GPT nano model.", elo: 1342, supported_rule_variants: ["berkeley", "berkeley_any"] }, { bot_id: "bot-3", username: "randobotany", display_name: "Random Any Bot", description: "Asks any pawn captures first, then plays random legal-looking moves.", elo: 1200, supported_rule_variants: ["berkeley_any"] }] })
})
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

  it("falls_back_to_player_when_the_auth_user_has_no_username_or_email", async () => {
    mockAuth.user = {}

    renderPage()

    expect(await screen.findByText("Signed in as player.")).toBeInTheDocument()
  })

  it("uses_game_id_fallbacks_for_active_games_and_created_active_games", async () => {
    mockApi.getMyGames.mockResolvedValue({
      games: [
        {
          game_id: "g-active-only",
          state: "active",
        },
      ],
    })
    mockApi.createGame.mockResolvedValueOnce({ game_id: "g-created-only", state: "active" })

    renderPage()

    expect(await screen.findByRole("link", { name: "Resume active game" })).toHaveAttribute("href", "/game/g-active-only")

    fireEvent.click(screen.getByRole("button", { name: "Create waiting game" }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/game/g-created-only")
    })
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

  it("renders_zeroes_when_lobby_stat_counts_are_missing", async () => {
    mockApi.getLobbyStats.mockResolvedValueOnce({})

    renderPage()

    expect(await screen.findByRole("heading", { name: "Lobby stats" })).toBeInTheDocument()
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4)
  })

  it("falls_back_to_email_for_the_signed_in_label_and_keeps_open_games_order_when_username_is_missing", async () => {
    mockAuth.user = { email: "fil@example.com" }
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_code: "FIRST01",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
        {
          game_code: "SECOND2",
          created_by: "amy",
          available_color: "black",
          created_at: "2026-04-03T23:59:58Z",
        },
      ],
    })

    renderPage()

    expect(await screen.findByText("Signed in as fil@example.com.")).toBeInTheDocument()
    const openGames = await screen.findAllByRole("listitem")
    expect(within(openGames[0]).getByText("FIRST01")).toBeInTheDocument()
    expect(within(openGames[0]).getByRole("button", { name: "Join" })).toBeInTheDocument()
    expect(within(openGames[1]).getByText("SECOND2")).toBeInTheDocument()
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

  it("shows_unknown_creator_when_an_open_game_has_no_owner", async () => {
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_code: "UNK001",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    const openGames = await screen.findAllByRole("listitem")
    expect(within(openGames[0]).getByText(/Unknown/)).toBeInTheDocument()
  })

  it("uses_game_id_fallbacks_when_opening_and_closing_an_owned_waiting_game_without_a_code", async () => {
    mockApi.getOpenGames.mockResolvedValue({
      games: [
        {
          game_id: "g-owned-only",
          created_by: "fil",
          available_color: "white",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Open" }))
    expect(mockNavigate).toHaveBeenCalledWith("/game/g-owned-only")

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))
    await waitFor(() => {
      expect(mockApi.deleteWaitingGame).toHaveBeenCalledWith("g-owned-only")
    })
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

  it("updates_the_bot_description_when_selecting_gpt_nano", async () => {
    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))
    const botSelect = await screen.findByLabelText("Bot opponent")
    fireEvent.change(botSelect, { target: { value: "bot-2" } })

    expect(screen.getByText("Model-driven Kriegspiel bot that chooses moves using GPT nano model.")).toBeInTheDocument()
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

  it("falls_back_to_the_first_supported_bot_and_its_raw_description", async () => {
    mockApi.getBots.mockResolvedValue({
      bots: [
        {
          bot_id: "bot-custom",
          username: "custombot",
          display_name: "Custom Bot",
          description: "Prefers puzzles.",
        },
      ],
    })

    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByLabelText("Bot opponent")).toHaveValue("bot-custom")
    expect(screen.getByText("Prefers puzzles.")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "Custom Bot (1200)" })).toBeInTheDocument()
  })

  it("shows_default_errors_when_loading_bots_open_games_and_lobby_stats_fail_without_details", async () => {
    mockApi.getBots.mockRejectedValueOnce({})
    mockApi.getOpenGames.mockRejectedValueOnce({})
    mockApi.getLobbyStats.mockRejectedValueOnce({})

    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))

    expect(await screen.findByText("Unable to load bots right now.")).toBeInTheDocument()
    expect(screen.getByText("Unable to load open games right now.")).toBeInTheDocument()
    expect(screen.getByText("Unable to load lobby stats right now.")).toBeInTheDocument()
  })

  it("falls_back_to_empty_open_games_and_bots_when_payload_arrays_are_missing", async () => {
    mockApi.getOpenGames.mockResolvedValueOnce({})
    mockApi.getBots.mockResolvedValueOnce({})

    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByLabelText("Bot opponent")).toHaveValue("")
    expect(screen.getByText("No bots support this ruleset.")).toBeInTheDocument()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
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

  it("joins_a_game_by_code_and_clears_the_input_on_success", async () => {
    mockApi.joinGame.mockResolvedValueOnce({ game_code: "PLAY01" })

    renderPage()

    const codeInput = await screen.findByLabelText("Game code")
    fireEvent.change(codeInput, { target: { value: "play01" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("PLAY01")
      expect(mockNavigate).toHaveBeenCalledWith("/game/PLAY01")
    })
    expect(codeInput).toHaveValue("")
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

  it("shows_the_default_join_error_when_join_by_code_fails_without_details", async () => {
    mockApi.joinGame.mockRejectedValueOnce({})

    renderPage()

    fireEvent.change(await screen.findByLabelText("Game code"), { target: { value: "fail01" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("FAIL01")
    })
    expect(await screen.findByText("Unable to join that game right now.")).toBeInTheDocument()
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

  it("joins_an_open_game_directly_on_success", async () => {
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
    mockApi.joinGame.mockResolvedValueOnce({ game_code: "ZZZ999" })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Join" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("ZZZ999")
      expect(mockNavigate).toHaveBeenCalledWith("/game/ZZZ999")
    })
  })

  it("shows_the_default_error_when_joining_an_open_game_fails_without_details", async () => {
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
    mockApi.joinGame.mockRejectedValueOnce({})

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Join" }))

    expect(await screen.findByText("Unable to join that game right now.")).toBeInTheDocument()
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

  it("uses_the_waiting_game_id_when_polling_promotes_a_game_without_a_game_code", async () => {
    mockApi.createGame.mockResolvedValueOnce({ game_id: "g-2", state: "waiting" })
    mockApi.getGame.mockResolvedValueOnce({ state: "active" })

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    await waitFor(() => {
      expect(mockApi.getGame).toHaveBeenCalledWith("g-2")
      expect(mockNavigate).toHaveBeenCalledWith("/game/g-2")
    })
  })

  it("restores_the_waiting_card_state_when_waiting_game_polling_fails", async () => {
    mockApi.createGame.mockResolvedValueOnce({ game_id: "g-1", game_code: "ABCD23", state: "waiting" })
    mockApi.getGame.mockRejectedValueOnce({})

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    await waitFor(() => {
      expect(mockApi.getGame).toHaveBeenCalledWith("g-1")
    })
    expect(await screen.findByText("waiting")).toBeInTheDocument()
    expect(screen.queryByText("Waiting for opponent…")).not.toBeInTheDocument()
  })

  it("falls_back_to_no_active_games_when_refreshing_my_games_fails", async () => {
    mockApi.getMyGames.mockRejectedValueOnce(new Error("My games exploded"))

    renderPage()

    await screen.findByRole("link", { name: "Leaderboard" })
    expect(screen.queryByRole("link", { name: "Resume active game" })).not.toBeInTheDocument()
  })

  it("keeps_resume_active_game_hidden_when_my_games_only_include_waiting_entries", async () => {
    mockApi.getMyGames.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-waiting-only",
          state: "waiting",
        },
      ],
    })

    renderPage()

    await screen.findByRole("link", { name: "Leaderboard" })
    expect(screen.queryByRole("link", { name: "Resume active game" })).not.toBeInTheDocument()
  })

  it("falls_back_to_no_active_games_when_my_games_payload_is_not_an_array", async () => {
    mockApi.getMyGames.mockResolvedValueOnce({})

    renderPage()

    await screen.findByRole("link", { name: "Leaderboard" })
    expect(screen.queryByRole("link", { name: "Resume active game" })).not.toBeInTheDocument()
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

  it("shows_the_default_error_when_closing_a_waiting_game_fails_without_details", async () => {
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
    mockApi.deleteWaitingGame.mockRejectedValueOnce({})

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Close" }))

    expect(await screen.findByText("Unable to close this waiting game right now.")).toBeInTheDocument()
  })

  it("shows_an_error_when_open_games_fail_to_load", async () => {
    mockApi.getOpenGames.mockRejectedValueOnce({ message: "Open exploded" })

    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Open exploded")
  })

  it("shows_the_default_error_when_creating_a_game_fails_without_details", async () => {
    mockApi.createGame.mockRejectedValueOnce({})

    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    expect(await screen.findByText("Unable to create game right now.")).toBeInTheDocument()
  })

  it("shows_the_default_action_error_when_the_auth_context_has_one", async () => {
    mockAuth.actionError = "Session drifted."

    renderPage()

    expect(await screen.findByRole("alert")).toHaveTextContent("Session drifted.")
  })

  it("hides_lobby_stats_tiles_when_the_stats_payload_is_null", async () => {
    mockApi.getLobbyStats.mockResolvedValueOnce(null)

    renderPage()

    await screen.findByRole("heading", { name: "Lobby stats" })
    expect(screen.queryByText("Active games now")).not.toBeInTheDocument()
  })
})
