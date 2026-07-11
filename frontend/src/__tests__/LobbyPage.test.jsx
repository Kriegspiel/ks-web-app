import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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
const mockApi = vi.hoisted(() => ({ createGame: vi.fn(), deleteWaitingGame: vi.fn(), joinGame: vi.fn(), getOpenGames: vi.fn(), getMyActiveGames: vi.fn(), getGame: vi.fn(), getBots: vi.fn(), getLobbyStats: vi.fn() }))
vi.mock("react-router-dom", async () => ({ ...(await vi.importActual("react-router-dom")), useNavigate: () => mockNavigate }))
vi.mock("../hooks/useAuth", () => ({ useAuth: () => mockAuth }))
vi.mock("../services/api", () => mockApi)

const mockClipboardWriteText = vi.fn()
const LAST_RULE_VARIANT_STORAGE_KEY = "kriegspiel.lastRuleVariant"

beforeEach(() => {
  window.localStorage.clear()
  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: mockClipboardWriteText },
  })
  mockClipboardWriteText.mockReset()
  mockClipboardWriteText.mockResolvedValue(undefined)
  mockNavigate.mockReset()
  mockAuth.user = { username: "fil" }
  mockAuth.actionError = ""
  Object.values(mockApi).forEach((fn) => fn.mockReset())
  mockApi.getOpenGames.mockResolvedValue({ games: [] })
  mockApi.getMyActiveGames.mockResolvedValue({ games: [] })
  mockApi.getLobbyStats.mockResolvedValue({ active_games_now: 123456789, completed_last_hour: 3, completed_last_24_hours: 42, completed_total: 314 })
  mockApi.getGame.mockResolvedValue({ state: "waiting" })
  mockApi.deleteWaitingGame.mockResolvedValue({})
  mockApi.getBots.mockResolvedValue({
    bots: [
      { bot_id: "bot-1", username: "randobot", display_name: "Random Bot", description: "Plays random legal-looking moves", elo: 1201, supported_rule_variants: ["berkeley", "berkeley_any"] },
      { bot_id: "bot-2", username: "llm_gptnano", display_name: "LLM GPT-Nano (bot)", description: "LLM GPT-Nano (bot) Kriegspiel model bot.", elo: 1342, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-3", username: "randobotany", display_name: "Random Any Bot", description: "Asks any pawn captures first, then plays random legal-looking moves.", elo: 1200, supported_rule_variants: ["berkeley_any"] },
      { bot_id: "bot-4", username: "llm_haiku", display_name: "LLM Haiku (bot)", description: "Anthropic model bot.", elo: 1300, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-5", username: "simpleheuristics", display_name: "Simple Heuristics Bot", description: "Uses simple tactical heuristics.", elo: 1250, supported_rule_variants: ["berkeley", "berkeley_any"] },
      { bot_id: "bot-6", username: "stockfishwild", display_name: "Stockfish Wild 16", description: "Experimental Stockfish-backed Wild 16 bot using public-state board hypotheses.", elo: 1260, supported_rule_variants: ["wild16"] },
      { bot_id: "bot-7", username: "darkboardmcts", display_name: "Darkboard MCTS", description: "Darkboard-inspired Wild 16 bot runtime.", elo: 1331, supported_rule_variants: ["wild16"] },
      { bot_id: "bot-8", username: "llm_nemotron_ultra", display_name: "LLM Nemotron Ultra (bot)", description: "Nemotron Ultra model bot.", elo: 1460, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-9", username: "llm_gemini31_pro_preview", display_name: "LLM Gemini 3.1 Pro Preview (bot)", description: "Gemini 3.1 Pro Preview model bot.", elo: 1600, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, required_tier: "tier4", llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-10", username: "llm_mistral_large3", display_name: "LLM Mistral Large 3 (bot)", description: "Mistral Large 3 model bot.", elo: 1475, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-11", username: "llm_mistral_nemo", display_name: "LLM Mistral Nemo (bot)", description: "Mistral Nemo model bot.", elo: 1180, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-12", username: "llm_gpt55", display_name: "LLM GPT-5.5 (bot)", description: "GPT-5.5 model bot.", elo: 1505, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-13", username: "llm_llama31_8b", display_name: "LLM Llama 3.1 8B (bot)", description: "Llama 3.1 8B model bot.", elo: 1311, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-14", username: "llm_llama4_scout", display_name: "LLM Llama 4 Scout (bot)", description: "Llama 4 Scout model bot.", elo: 1312, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-15", username: "llm_llama4_maverick", display_name: "LLM Llama 4 Maverick (bot)", description: "Llama 4 Maverick model bot.", elo: 1313, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-16", username: "llm_gemma3_4b", display_name: "LLM Gemma 3 4B (bot)", description: "Gemma 3 4B model bot.", elo: 1314, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-17", username: "llm_gemma3_27b", display_name: "LLM Gemma 3 27B (bot)", description: "Gemma 3 27B model bot.", elo: 1315, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-18", username: "llm_gemma4_31b", display_name: "LLM Gemma 4 31B (bot)", description: "Gemma 4 31B model bot.", elo: 1316, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
      { bot_id: "bot-19", username: "openrouter_llama31_8b", display_name: "OpenRouter Llama 3.1 8B (bot)", description: "Legacy Llama 3.1 8B model bot.", elo: 1317, supported_rule_variants: ["berkeley", "berkeley_any"], llm_backed: true, llm_bot_limit_label: "No ply limit" },
    ],
  })
})
afterEach(() => { cleanup(); window.localStorage.clear(); vi.useRealTimers() })

function renderPage() {
  render(
    <MemoryRouter>
      <LobbyPage />
    </MemoryRouter>,
  )
}

async function openBotPicker() {
  const picker = await screen.findByRole("combobox", { name: "Bot opponent" })
  fireEvent.click(picker)
  return picker
}

function botOptionLabels() {
  return within(screen.getByRole("listbox", { name: "Bot opponent" }))
    .getAllByRole("option")
    .map((option) => option.getAttribute("aria-label"))
}

describe("LobbyPage", () => {
  it("uses_theme_surface_tokens_for_lobby_list_cards", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/Lobby.css"), "utf8")

    expect(css).toContain("background: color-mix(in srgb, var(--surface-strong) 92%, var(--surface) 8%);")
    expect(css).toContain(".lobby-open-games-list")
    expect(css).toContain("max-height: calc((var(--lobby-open-game-row-min-height) * 5) + (0.75rem * 4));")
    expect(css).toContain("overflow-y: auto;")
    expect(css).toContain(".lobby-open-games-list li.is-joinable")
    expect(css).toContain(".lobby-open-game__opponent")
    expect(css).toContain(".lobby-open-game__rules")
    expect(css).toContain(".lobby-open-game__color")
    expect(css).toContain(".lobby-open-game__meta")
    expect(css).toContain(".lobby-open-game__meta-separator")
    expect(css).toContain("button.lobby-open-game__code-button")
    expect(css).toContain(".lobby-open-game__code")
    expect(css).toContain(".lobby-copy-status")
    expect(css).toContain(".lobby-toast-region")
    expect(css).toContain(".lobby-toast--danger")
    expect(css).toContain(".lobby-toast__action")
    expect(css).toContain("@keyframes lobby-toast-fade")
    expect(css).toContain(".lobby-created-game__line")
    expect(css).toContain("button.lobby-created-game__code-button")
    expect(css).toContain(".lobby-created-game__copy-link-button")
    expect(css).toContain("font-family: ui-monospace")
    expect(css).toContain(".lobby-bot-tier-picker__option.is-unavailable")
    expect(css).not.toContain("background: rgba(248, 250, 252, 0.72);")
  })

  it("shows_lobby_version_badge", async () => {
    renderPage()

    expect(await screen.findAllByText(TEST_VERSION_STAMP)).toHaveLength(1)

  })

  it("shows_lobby_quick_actions", async () => {
    mockApi.getMyActiveGames.mockResolvedValue({
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

  it("preselects_the_last_selected_ruleset_and_persists_new_choices", async () => {
    window.localStorage.setItem(LAST_RULE_VARIANT_STORAGE_KEY, "wild16")

    renderPage()

    const rulesetSelect = await screen.findByLabelText("Ruleset")
    expect(rulesetSelect).toHaveValue("wild16")

    fireEvent.change(rulesetSelect, { target: { value: "cincinnati" } })

    expect(rulesetSelect).toHaveValue("cincinnati")
    expect(window.localStorage.getItem(LAST_RULE_VARIANT_STORAGE_KEY)).toBe("cincinnati")
  })

  it("falls_back_to_berkeley_any_when_the_stored_ruleset_is_unknown", async () => {
    window.localStorage.setItem(LAST_RULE_VARIANT_STORAGE_KEY, "mystery")

    renderPage()

    expect(await screen.findByLabelText("Ruleset")).toHaveValue("berkeley_any")
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
    mockApi.getMyActiveGames.mockResolvedValue({
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

  it("shows_a_message_when_there_are_no_open_games", async () => {
    renderPage()

    expect(await screen.findByText("No open games yet. Create a waiting game and it will appear here.")).toBeInTheDocument()
    expect(screen.queryAllByRole("listitem")).toHaveLength(0)
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
    expect(await screen.findByText("Active games now")).toBeInTheDocument()
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
          rule_variant: "wild16",
          created_by: "randobotany",
          available_color: "black",
          created_at: "2026-04-03T23:59:59Z",
        },
      ],
    })

    renderPage()

    expect(await screen.findByRole("link", { name: "randobotany (bot)" })).toHaveAttribute("href", "/user/randobotany")
    expect(screen.getByText("Rules: Wild 16")).toHaveClass("lobby-open-game__rules")
    expect(screen.getByText("Color: black")).toHaveClass("lobby-open-game__color")
    expect(await screen.findByText(/2026-04-03 23:59:59 UTC/)).toBeInTheDocument()

    const openGame = (await screen.findAllByRole("listitem"))[0]
    expect(within(openGame).getByText("ABCD23")).toHaveClass("lobby-open-game__code")
    expect(within(openGame).getByRole("button", { name: "Copy game code ABCD23" })).toBeInTheDocument()

    const text = openGame.textContent
    expect(text.indexOf("randobotany (bot)")).toBeLessThan(text.indexOf("Rules: Wild 16"))
    expect(text.indexOf("Rules: Wild 16")).toBeLessThan(text.indexOf("Color: black"))
    expect(text.indexOf("Color: black")).toBeLessThan(text.indexOf("2026-04-03 23:59:59 UTC"))
    expect(text.indexOf("2026-04-03 23:59:59 UTC")).toBeLessThan(text.indexOf("ABCD23"))
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
    expect(screen.getByRole("button", { name: "Copy game code ABCD23" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy link" })).toBeInTheDocument()
    expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({ opponent_type: "human", bot_id: undefined, rule_variant: "berkeley" }))
  })

  it("copies_created_waiting_game_code_and_share_link", async () => {
    mockApi.createGame.mockResolvedValue({ game_id: "g-1", game_code: "ABCD23", state: "waiting" })
    renderPage()

    fireEvent.click(await screen.findByRole("button", { name: "Create waiting game" }))

    const codeButton = await screen.findByRole("button", { name: "Copy game code ABCD23" })
    fireEvent.click(codeButton)

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith("ABCD23")
    })
    expect(screen.getByText("Game code ABCD23 copied.").closest(".lobby-toast")).toHaveClass("lobby-toast")

    const shareLink = screen.getByRole("link", { name: /\/join\/ABCD23$/ })
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenLastCalledWith(shareLink.href)
    })
    expect(screen.getByText("Share link copied.").closest(".lobby-toast")).toHaveClass("lobby-toast")
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
    const picker = await screen.findByRole("combobox", { name: "Bot opponent" })
    expect(screen.getByText("Plays random legal-looking moves.")).toBeInTheDocument()
    expect(picker).toHaveTextContent("1201")
    expect(picker).toHaveTextContent("Random Bot")

    fireEvent.click(picker)
    const listbox = screen.getByRole("listbox", { name: "Bot opponent" })
    expect(within(listbox).getByText("Simple bots")).toBeInTheDocument()
    expect(within(listbox).getByText("Casual bots")).toBeInTheDocument()
    expect(within(listbox).getByText("Club bots")).toBeInTheDocument()
    expect(within(listbox).getByText("Strong bots")).toBeInTheDocument()
    expect(within(listbox).getByText("Expert bots")).toBeInTheDocument()
    expect(within(listbox).getAllByText("T0")[0]).toHaveClass("tier-badge", "tier-badge--t0")
    expect(within(listbox).getAllByText("T1")[0]).toHaveClass("tier-badge", "tier-badge--t1")
    expect(within(listbox).getAllByText("T2")[0]).toHaveClass("tier-badge", "tier-badge--t2")
    expect(within(listbox).getAllByText("T3")[0]).toHaveClass("tier-badge", "tier-badge--t3")
    expect(within(listbox).getAllByText("T4")[0]).toHaveClass("tier-badge", "tier-badge--t4")
    expect(screen.getByRole("option", { name: "1201 - Random Bot" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1250 - Simple Heuristics Bot" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1342 - LLM GPT-Nano" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1300 - LLM Haiku" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1313 - LLM Llama 4 Maverick" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1316 - LLM Gemma 4 31B" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1475 - LLM Mistral Large 3" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1505 - LLM GPT-5.5" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1460 - LLM Nemotron Ultra" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1600 - LLM Gemini 3.1 Pro Preview" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1200 - Random Any Bot" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1180 - LLM Mistral Nemo" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1311 - LLM Llama 3.1 8B" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1312 - LLM Llama 4 Scout" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1314 - LLM Gemma 3 4B" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1315 - LLM Gemma 3 27B" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1317 - OpenRouter Llama 3.1 8B" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1250 - Simple Heuristics Bot" })).not.toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1342 - LLM GPT-Nano" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1300 - LLM Haiku" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1313 - LLM Llama 4 Maverick" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1316 - LLM Gemma 4 31B" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1475 - LLM Mistral Large 3" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1505 - LLM GPT-5.5" })).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("option", { name: "1600 - LLM Gemini 3.1 Pro Preview" })).toHaveAttribute("aria-disabled", "true")
    expect(within(screen.getByRole("option", { name: "1342 - LLM GPT-Nano" })).getByText("Requires T2")).toBeInTheDocument()
    expect(within(screen.getByRole("option", { name: "1313 - LLM Llama 4 Maverick" })).getByText("Requires T2")).toBeInTheDocument()
    expect(within(screen.getByRole("option", { name: "1316 - LLM Gemma 4 31B" })).getByText("Requires T2")).toBeInTheDocument()
    expect(within(screen.getByRole("option", { name: "1475 - LLM Mistral Large 3" })).getByText("Requires T3")).toBeInTheDocument()
    expect(within(screen.getByRole("option", { name: "1505 - LLM GPT-5.5" })).getByText("Requires T3")).toBeInTheDocument()
    expect(within(screen.getByRole("option", { name: "1600 - LLM Gemini 3.1 Pro Preview" })).getByText("Requires T4")).toBeInTheDocument()
    expect(botOptionLabels()).toEqual([
      "1200 - Random Any Bot",
      "1201 - Random Bot",
      "1250 - Simple Heuristics Bot",
      "1300 - LLM Haiku",
      "1313 - LLM Llama 4 Maverick",
      "1316 - LLM Gemma 4 31B",
      "1342 - LLM GPT-Nano",
      "1460 - LLM Nemotron Ultra",
      "1475 - LLM Mistral Large 3",
      "1505 - LLM GPT-5.5",
      "1600 - LLM Gemini 3.1 Pro Preview",
    ])
    expect(screen.queryByText("(No ply limit)")).not.toBeInTheDocument()
    expect(screen.queryByText("LLM Haiku (bot)")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Create bot game" }))
    await waitFor(() => expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({ opponent_type: "bot", bot_id: "bot-1" })))
    expect(mockNavigate).toHaveBeenCalledWith("/game/BOT123")
  })

  it("keeps_higher_tier_bots_visible_and_routes_unavailable_choices_to_subscription", async () => {
    mockAuth.user = { username: "guest_jan_fine", is_guest: true, llm_bot_tier: "guest" }

    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))
    await openBotPicker()

    const randomBot = screen.getByRole("option", { name: "1201 - Random Bot" })
    const simpleBot = screen.getByRole("option", { name: "1250 - Simple Heuristics Bot" })
    const gptBot = screen.getByRole("option", { name: "1342 - LLM GPT-Nano" })
    expect(randomBot).not.toHaveAttribute("aria-disabled", "true")
    expect(simpleBot).toHaveAttribute("aria-disabled", "true")
    expect(gptBot).toHaveAttribute("aria-disabled", "true")
    expect(within(simpleBot).getByText("Requires T1")).toBeInTheDocument()
    expect(within(gptBot).getByText("Requires T2")).toBeInTheDocument()

    fireEvent.click(simpleBot)

    expect(mockNavigate).toHaveBeenCalledWith("/subscription")
    expect(mockApi.createGame).not.toHaveBeenCalled()
  })

  it("shows_wild16_bots_as_t1_bots", async () => {
    renderPage()

    fireEvent.change(await screen.findByLabelText("Ruleset"), { target: { value: "wild16" } })
    fireEvent.click(await screen.findByLabelText("Bot"))
    const picker = await screen.findByRole("combobox", { name: "Bot opponent" })
    expect(picker).toHaveTextContent("1260")
    expect(picker).toHaveTextContent("Stockfish Wild 16")

    fireEvent.click(picker)
    const listbox = screen.getByRole("listbox", { name: "Bot opponent" })
    expect(within(listbox).getByText("Casual bots")).toBeInTheDocument()
    expect(within(listbox).getByText("T1")).toHaveClass("tier-badge", "tier-badge--t1")
    expect(screen.getByRole("option", { name: "1260 - Stockfish Wild 16" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1331 - Darkboard MCTS" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1250 - Simple Heuristics Bot" })).not.toBeInTheDocument()
    expect(botOptionLabels()).toEqual(["1260 - Stockfish Wild 16", "1331 - Darkboard MCTS"])
  })

  it("shows_all_ruleset_options_and_supports_new_variant_specific_bots", async () => {
    mockApi.getBots.mockResolvedValue({
      bots: [
        {
          bot_id: "bot-cincinnati",
          username: "cincybot",
          display_name: "Cincinnati Bot",
          description: "Knows Cincinnati.",
          elo: 1420,
          supported_rule_variants: ["cincinnati"],
        },
        {
          bot_id: "bot-wild16",
          username: "wildbot",
          display_name: "Wild 16 Bot",
          description: "Knows Wild 16.",
          elo: 1510,
          supported_rule_variants: ["wild16"],
        },
        {
          bot_id: "bot-crazy",
          username: "crazybot",
          display_name: "Crazy Bot",
          description: "Knows CrazyKrieg.",
          elo: 1601,
          supported_rule_variants: ["crazykrieg"],
        },
      ],
    })

    renderPage()

    const rulesetSelect = await screen.findByLabelText("Ruleset")
    expect(within(rulesetSelect).getByRole("option", { name: "Berkeley" })).toBeInTheDocument()
    expect(within(rulesetSelect).getByRole("option", { name: "Berkeley + Any" })).toBeInTheDocument()
    expect(within(rulesetSelect).getByRole("option", { name: "Cincinnati" })).toBeInTheDocument()
    expect(within(rulesetSelect).getByRole("option", { name: "Wild 16" })).toBeInTheDocument()
    expect(within(rulesetSelect).getByRole("option", { name: "RAND" })).toBeInTheDocument()
    expect(within(rulesetSelect).getByRole("option", { name: "English" })).toBeInTheDocument()
    expect(within(rulesetSelect).getByRole("option", { name: "CrazyKrieg" })).toBeInTheDocument()

    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByRole("combobox", { name: "Bot opponent" })).toBeDisabled()
    expect(screen.getByText("No bots support this ruleset.")).toBeInTheDocument()

    fireEvent.change(rulesetSelect, { target: { value: "cincinnati" } })
    fireEvent.click(screen.getByRole("combobox", { name: "Bot opponent" }))
    expect(screen.getByRole("option", { name: "1420 - Cincinnati Bot" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1510 - Wild 16 Bot" })).not.toBeInTheDocument()

    fireEvent.change(rulesetSelect, { target: { value: "wild16" } })
    expect(screen.getByRole("option", { name: "1510 - Wild 16 Bot" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1420 - Cincinnati Bot" })).not.toBeInTheDocument()

    fireEvent.change(rulesetSelect, { target: { value: "crazykrieg" } })
    expect(screen.getByRole("option", { name: "1601 - Crazy Bot" })).toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "1510 - Wild 16 Bot" })).not.toBeInTheDocument()
  })

  it("updates_the_bot_description_when_selecting_gpt_nano", async () => {
    mockAuth.user = { username: "club_player", llm_bot_tier: "tier2" }
    renderPage()

    fireEvent.click(await screen.findByLabelText("Bot"))
    await openBotPicker()
    fireEvent.click(screen.getByRole("option", { name: "1342 - LLM GPT-Nano" }))

    expect(screen.getByText("LLM GPT-Nano (bot) Kriegspiel model bot.")).toBeInTheDocument()
  })

  it("filters_unsupported_bots_for_selected_ruleset", async () => {
    renderPage()
    fireEvent.change(await screen.findByLabelText("Ruleset"), { target: { value: "berkeley" } })
    fireEvent.click(await screen.findByLabelText("Bot"))
    await openBotPicker()
    expect(screen.queryByRole("option", { name: "1200 - Random Any Bot" })).not.toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1201 - Random Bot" })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "1342 - LLM GPT-Nano" })).toBeInTheDocument()
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
    expect(await screen.findByRole("combobox", { name: "Bot opponent" })).toHaveTextContent("1200")
    expect(screen.getByRole("combobox", { name: "Bot opponent" })).toHaveTextContent("Custom Bot")
    expect(screen.getByText("Prefers puzzles.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("combobox", { name: "Bot opponent" }))
    expect(screen.getByRole("option", { name: "1200 - Custom Bot" })).toBeInTheDocument()
  })

  it("does_not_treat_missing_bot_rulesets_as_support_for_new_variants", async () => {
    mockAuth.user = { username: "club_player", llm_bot_tier: "tier2" }
    mockApi.getBots.mockResolvedValue({
      bots: [
        {
          bot_id: "bot-legacy",
          username: "llm_gptnano",
          display_name: "LLM GPT-Nano (bot)",
          description: "Legacy metadata.",
          elo: 1229,
        },
      ],
    })

    renderPage()

    const rulesetSelect = await screen.findByLabelText("Ruleset")
    fireEvent.click(await screen.findByLabelText("Bot"))
    expect(await screen.findByRole("combobox", { name: "Bot opponent" })).toHaveTextContent("1229")
    fireEvent.click(screen.getByRole("combobox", { name: "Bot opponent" }))
    expect(screen.getByRole("option", { name: "1229 - LLM GPT-Nano" })).toBeInTheDocument()

    fireEvent.change(rulesetSelect, { target: { value: "crazykrieg" } })
    expect(screen.queryByRole("option", { name: "1229 - LLM GPT-Nano" })).not.toBeInTheDocument()
    expect(screen.getByText("No bots support this ruleset.")).toBeInTheDocument()
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
    expect(await screen.findByRole("combobox", { name: "Bot opponent" })).toBeDisabled()
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
    await screen.findByRole("combobox", { name: "Bot opponent" })
    fireEvent.change(screen.getByLabelText("Ruleset"), { target: { value: "berkeley" } })
    expect(screen.getByRole("combobox", { name: "Bot opponent" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Create bot game" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Pick an available bot before creating the game.")
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

  it("shows_a_top_toast_with_subscription_action_for_tier_join_errors", async () => {
    mockApi.joinGame.mockRejectedValueOnce({
      status: 403,
      code: "BOT_TIER_REQUIRED",
      message: "Your current tier does not include this bot",
    })

    renderPage()

    fireEvent.change(await screen.findByLabelText("Game code"), { target: { value: "u2my7x" } })
    fireEvent.click(screen.getByRole("button", { name: "Join game" }))

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("U2MY7X")
    })

    const toast = await screen.findByRole("alert")
    expect(toast).toHaveClass("lobby-toast", "lobby-toast--danger")
    expect(toast).toHaveTextContent("Your current tier does not include this bot")
    expect(within(toast).getByRole("link", { name: "Change tier" })).toHaveAttribute("href", "/subscription")
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

  it("joins_an_open_game_when_clicking_the_game_row", async () => {
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

    const openGamesSection = (await screen.findByRole("heading", { name: "Open games" })).closest("section")
    const openGame = await within(openGamesSection).findByRole("listitem")

    fireEvent.click(within(openGame).getByRole("link", { name: "randobot (bot)" }))
    expect(mockApi.joinGame).not.toHaveBeenCalled()

    fireEvent.click(openGame)

    await waitFor(() => {
      expect(mockApi.joinGame).toHaveBeenCalledWith("ZZZ999")
      expect(mockNavigate).toHaveBeenCalledWith("/game/ZZZ999")
    })
  })

  it("copies_an_open_game_code_without_joining_the_game", async () => {
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

    const openGamesSection = (await screen.findByRole("heading", { name: "Open games" })).closest("section")
    const openGame = await within(openGamesSection).findByRole("listitem")

    fireEvent.click(within(openGame).getByRole("button", { name: "Copy game code ZZZ999" }))

    await waitFor(() => {
      expect(mockClipboardWriteText).toHaveBeenCalledWith("ZZZ999")
    })
    expect(await screen.findByRole("status")).toHaveTextContent("Game code ZZZ999 copied.")
    expect(mockApi.joinGame).not.toHaveBeenCalled()

    fireEvent.click(openGame)

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
    mockApi.getMyActiveGames.mockRejectedValueOnce(new Error("My games exploded"))

    renderPage()

    await screen.findByRole("link", { name: "Leaderboard" })
    expect(screen.queryByRole("link", { name: "Resume active game" })).not.toBeInTheDocument()
  })

  it("keeps_resume_active_game_hidden_when_my_games_only_include_waiting_entries", async () => {
    mockApi.getMyActiveGames.mockResolvedValueOnce({
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
    mockApi.getMyActiveGames.mockResolvedValueOnce({})

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
