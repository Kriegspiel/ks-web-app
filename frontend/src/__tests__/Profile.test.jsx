import fs from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import ProfilePage from "../pages/Profile"

const mockApi = vi.hoisted(() => ({
  createGame: vi.fn(),
  getBots: vi.fn(),
  userApi: {
    getProfile: vi.fn(),
    getGameHistory: vi.fn(),
    getRatingHistory: vi.fn(),
  },
}))
const mockAuthState = vi.hoisted(() => ({
  value: {
    user: null,
    convertGuest: vi.fn(),
    actionLoading: false,
  },
}))

vi.mock("../services/api", () => mockApi)
vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuthState.value,
}))

afterEach(() => cleanup())

beforeEach(() => {
  mockApi.createGame.mockReset()
  mockApi.getBots.mockReset()
  mockApi.getBots.mockResolvedValue({ bots: [] })
  mockApi.userApi.getProfile.mockReset()
  mockApi.userApi.getGameHistory.mockReset()
  mockApi.userApi.getRatingHistory.mockReset()
  mockAuthState.value = {
    user: null,
    convertGuest: vi.fn(),
    actionLoading: false,
  }
})

function renderProfile(path = "/user/fil") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/user/:username" element={<ProfilePage />} />
        <Route path="/game/:gameRef" element={<main><h1>Game route</h1></main>} />
        <Route path="/subscription" element={<main><h1>Subscription route</h1></main>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProfilePage", () => {
  it("keeps_profile_tier_badges_aligned_with_the_public_tier_palette", () => {
    const badgeCss = fs.readFileSync("src/components/TierBadge.css", "utf8")
    const profileCss = fs.readFileSync("src/pages/Profile.css", "utf8")

    expect(badgeCss).toContain("--tier-badge-corner: #8c725e")
    expect(badgeCss).toContain(".tier-badge--t1 {\n  --tier-badge-color: #4a3325;\n  --tier-badge-corner: #d38555;")
    expect(badgeCss).toContain(".tier-badge--t2 {\n  --tier-badge-color: #5a4a1f;\n  --tier-badge-corner: #d8bb45;")
    expect(badgeCss).toContain(".tier-badge--t3 {\n  --tier-badge-color: #31553f;\n  --tier-badge-corner: #7bd995;")
    expect(badgeCss).toContain(".tier-badge--t4 {\n  --tier-badge-color: #255660;\n  --tier-badge-corner: #67d9ec;")
    expect(badgeCss).toContain(".tier-badge--t5 {\n  --tier-badge-color: #2f4772;\n  --tier-badge-corner: #86a8ff;")
    expect(badgeCss).toContain(".tier-badge--t6 {\n  --tier-badge-color: #56345d;\n  --tier-badge-corner: #d88fe8;")
    expect(badgeCss).toContain(".tier-badge--td {\n  --tier-badge-color: #3f3f46;\n  --tier-badge-corner: #a1a1aa;")
    expect(badgeCss).toContain(".tier-badge::before")
    expect(badgeCss).toContain("clip-path: polygon(100% 0, 0 0, 100% 100%)")
    expect(profileCss).toContain("--tier-badge-size: 2.35rem")
    expect(profileCss).toContain("transition: border-color 0.16s ease, box-shadow 0.16s ease;")
    expect(profileCss).not.toContain("transform 0.16s ease")
    expect(profileCss).not.toContain("transform: translateY")
  })

  it("keeps_profile_challenge_controls_balanced", () => {
    const profileCss = fs.readFileSync("src/pages/Profile.css", "utf8")

    expect(profileCss).toContain("--profile-challenge-control-height: 3.45rem")
    expect(profileCss).toContain(".profile-challenge-form select")
    expect(profileCss).toContain("font-weight: 500")
    expect(profileCss).toContain(".profile-challenge-form option")
    expect(profileCss).toContain("font-weight: 400")
    expect(profileCss).toContain(".profile-challenge-form button")
    expect(profileCss).toContain("height: var(--profile-challenge-control-height)")
    expect(profileCss).toContain(".profile-challenge-upgrade__bot-name")
    expect(profileCss).toContain(".profile-challenge-upgrade__tier-link")
    expect(profileCss).toContain(".profile-challenge-upgrade__tier-code")
  })

  it("renders_profile_stats_and_recent_games", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "fil",
      llm_bot_tier: "tier2",
      member_since: "2026-01-01T00:00:00Z",
      stats: {
        elo: 1345,
        elo_peak: 1401,
        results: {
          overall: { games_played: 22237, games_won: 632, games_lost: 5538, games_drawn: 16067 },
          vs_humans: { games_played: 1, games_won: 1, games_lost: 0, games_drawn: 0 },
          vs_bots: { games_played: 9, games_won: 5, games_lost: 3, games_drawn: 1 },
        },
        ratings: {
          overall: { elo: 1345, peak: 1401 },
          vs_humans: { elo: 1290, peak: 1325 },
          vs_bots: { elo: 1410, peak: 1412 },
        },
      },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-legacy-bot",
          result: "win",
          rule_variant: "berkeley_any",
          opponent: "legacybot",
          opponent_role: "bot",
          played_at: "2026-03-20T12:00:00Z",
          elo_after: 1500,
          elo_delta: 30,
          rating_snapshot: {
            overall: { elo_after: 1500, elo_delta: 30 },
            vs_humans: { elo_after: null, elo_delta: null },
            vs_bots: { elo_after: null, elo_delta: null },
          },
        },
        {
          game_id: "g-1",
          result: "win",
          rule_variant: "cincinnati",
          opponent: "amy",
          opponent_role: "user",
          played_at: "2026-03-21T12:00:00Z",
          elo_after: 1320,
          elo_delta: 16,
          rating_snapshot: {
            overall: { elo_after: 1320, elo_delta: 16 },
            vs_humans: { elo_after: 1290, elo_delta: 16 },
            vs_bots: { elo_after: null, elo_delta: null },
          },
        },
        {
          game_id: "g-2",
          result: "loss",
          rule_variant: "wild16",
          opponent: "bob",
          opponent_role: "bot",
          played_at: "2026-03-25T12:00:00Z",
          elo_after: 1345,
          elo_delta: 25,
          rating_snapshot: {
            overall: { elo_after: 1345, elo_delta: 25 },
            vs_humans: { elo_after: null, elo_delta: null },
            vs_bots: { elo_after: 1412, elo_delta: 2 },
          },
        },
      ],
    })
    mockApi.userApi.getRatingHistory.mockResolvedValue({
      series: {
        game: [
          { label: "Game 1", elo: 1290, delta: 16, played_at: "2026-03-21T12:00:00Z", game_number: 1 },
          { label: "Game 2", elo: 1412, delta: 2, played_at: "2026-03-25T12:00:00Z", game_number: 2 },
        ],
        date: [
          { label: "2026-03-21", elo: 1290, delta: 16, played_at: "2026-03-21T12:00:00Z", game_number: 1 },
          { label: "2026-03-25", elo: 1412, delta: 122, played_at: "2026-03-25T12:00:00Z", game_number: 2 },
        ],
      },
    })

    renderProfile()

    await screen.findByRole("heading", { name: "fil" })
    expect(mockApi.userApi.getGameHistory).toHaveBeenCalledWith("fil", 1, 20, { includeFilterOptions: false })
    expect(screen.getByText("Member since 2026-01-01.")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Player tier" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Player tier" })).getByRole("link", { name: "Player tier: Tier T2 Club. View subscription options" })).toHaveAttribute("href", "/subscription")
    expect(screen.getByRole("heading", { name: "Tier T2 Club" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Player tier" })).getByText("T2")).toHaveClass("tier-badge", "tier-badge--t2", "profile-tier-card__code")
    expect(screen.queryByText(/language-model bot games/i)).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall rating." })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Overall results." })).toBeInTheDocument()
    expect(screen.getByText(/games played/i)).toBeInTheDocument()
    expect(screen.getByText("22,237")).toBeInTheDocument()
    expect(screen.getByText("632 (2.8%)")).toBeInTheDocument()
    expect(screen.getByText("5,538 (24.9%)")).toBeInTheDocument()
    expect(screen.getByText("16,067 (72.3%)")).toBeInTheDocument()
    expect(screen.queryByText("22237")).not.toBeInTheDocument()
    expect(screen.queryByText("5538 (24.9%)")).not.toBeInTheDocument()
    expect(screen.queryByText("16067 (72.3%)")).not.toBeInTheDocument()
    expect(screen.queryByText(/win rate/i)).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Overall Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Start 1290")).toBeInTheDocument()
    expect(screen.getByText("Latest 1412")).toBeInTheDocument()
    expect(screen.getAllByText("2026-03-25").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "Game number" }))
    expect(screen.getAllByText("Game 2").length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole("tab", { name: "vs Humans" }))
    await waitFor(() => expect(mockApi.userApi.getRatingHistory).toHaveBeenCalledWith("fil", "vs_humans", 100))
    expect(screen.getByRole("heading", { name: "vs Humans rating." })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Humans results." })).toBeInTheDocument()
    expect(screen.getByText("1 (100.0%)")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "vs Bots" }))
    expect(screen.getByText("1410")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "vs Bots rating." })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "vs Bots Elo rating over time" })).toBeInTheDocument()
    expect(screen.getByText("Start 1290")).toBeInTheDocument()
    expect(screen.getByText("Latest 1412")).toBeInTheDocument()
    expect(screen.getByText("5 (55.6%)")).toBeInTheDocument()
    expect(screen.getByText(/win vs amy · Cincinnati/i)).toBeInTheDocument()
    expect(screen.getByText(/loss vs bob · Wild 16/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View all games" })).toHaveAttribute("href", "/user/fil/games")
  })

  it("shows_not_found_message_on_404", async () => {
    mockApi.userApi.getProfile.mockRejectedValueOnce({ status: 404, message: "nope" })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Profile not found.")
    })
  })

  it("shows_bot_note_with_external_blog_link", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_gptoss120b",
      role: "bot",
      llm_bot_tier: "tier4",
      owner_email: "bot-gpt-oss@kriegspiel.org",
      member_since: "2026-04-03T01:10:41Z",
      stats: {
        elo: 1200,
        elo_peak: 1200,
        ratings: {
          overall: { elo: 1200, peak: 1200 },
          vs_humans: { elo: 1200, peak: 1200 },
          vs_bots: { elo: 1200, peak: 1200 },
        },
      },
      user_metrics: {
        completed_games: 22240,
        average_duration_seconds: 420,
        average_turn_count: 18.5,
        overall: { total_games: 4, wins: 2, losses: 1, draws: 1, win_rate: 0.5 },
        vs_humans: { total_games: 2, wins: 2, losses: 0, draws: 0, win_rate: 1.0 },
        vs_bots: { total_games: 2, wins: 0, losses: 1, draws: 1, win_rate: 0.0 },
        as_white: { total_games: 11213, wins: 305, losses: 2829, draws: 8079, win_rate: 0.027 },
        as_black: { total_games: 11027, wins: 327, losses: 2709, draws: 7991, win_rate: 0.03 },
        opponents: [
          { username: "llm_haiku", role: "bot", total_games: 16190, wins: 228, losses: 3766, draws: 12196, win_rate: 0.014 },
          { username: "fil", role: "user", total_games: 4342, wins: 67, losses: 1409, draws: 2866, win_rate: 0.015 },
        ],
        rulesets: [
          { rule_variant: "wild16", total_games: 1211, wins: 55, losses: 200, draws: 956, win_rate: 0.045 },
          { rule_variant: "berkeley_any", total_games: 1, wins: 1, losses: 0, draws: 0, win_rate: 1.0 },
        ],
      },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_gptoss120b")

    await screen.findByRole("heading", { name: "llm_gptoss120b" })
    expect(screen.queryByRole("region", { name: "Player tier" })).not.toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByRole("link", { name: "Bot tier: Tier T2 Club. View subscription options" })).toHaveAttribute("href", "/subscription")
    expect(screen.getByRole("heading", { name: "Tier T2 Club" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T2")).toHaveClass("tier-badge", "tier-badge--t2", "profile-tier-card__code")
    expect(screen.getByText("GPT-OSS 120B model bot for T2 Club.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "This user is bot" })).toBeInTheDocument()
    expect(screen.getByText(/On Kriegspiel\.org we allow bots\./i)).toBeInTheDocument()
    expect(screen.getByText(/You also can create your own bot – more bots, more fun\./i)).toBeInTheDocument()
    expect(screen.getByText(/Email address of this bot owner is bot-gpt-oss@kriegspiel\.org\./i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "blog post about bots ↗" })).toHaveAttribute("href", "https://kriegspiel.org/blog/bot-registration-flow")
    expect(screen.getByRole("link", { name: "blog post about bots ↗" })).toHaveAttribute("target", "_blank")
    expect(screen.getByRole("heading", { name: "User metrics" })).toBeInTheDocument()
    expect(screen.getByText("Completed games")).toBeInTheDocument()
    expect(screen.getByText("22,240")).toBeInTheDocument()
    expect(screen.queryByText("22240")).not.toBeInTheDocument()
    expect(screen.getByText("vs Bots win rate")).toBeInTheDocument()
    expect(screen.getAllByText("0.0%").length).toBeGreaterThan(0)
    expect(screen.getByText("vs Humans win rate")).toBeInTheDocument()
    expect(screen.getAllByText("100.0%").length).toBeGreaterThan(0)
    expect(screen.getByText("Average turns count")).toBeInTheDocument()
    expect(screen.getByText("18.5")).toBeInTheDocument()
    expect(screen.getByText("Average duration")).toBeInTheDocument()
    expect(screen.getByText("7m")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "White" })).toHaveAttribute("href", "/user/llm_gptoss120b/games?color=white")
    expect(screen.getByRole("link", { name: "Black" })).toHaveAttribute("href", "/user/llm_gptoss120b/games?color=black")
    expect(screen.getByText("305-2,829-8,079 · 2.7%")).toBeInTheDocument()
    expect(screen.getByText("327-2,709-7,991 · 3.0%")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "llm_haiku (bot)" })).toHaveAttribute("href", "/user/llm_gptoss120b/games?opponent=llm_haiku")
    expect(screen.getByRole("link", { name: "fil" })).toHaveAttribute("href", "/user/llm_gptoss120b/games?opponent=fil")
    expect(screen.getByText("228-3,766-12,196 · 1.4%")).toBeInTheDocument()
    expect(screen.getByText("67-1,409-2,866 · 1.5%")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Wild 16" })).toHaveAttribute("href", "/user/llm_gptoss120b/games?rule_set=wild16")
    expect(screen.getByRole("link", { name: "Berkeley + Any" })).toHaveAttribute("href", "/user/llm_gptoss120b/games?rule_set=berkeley_any")
    expect(screen.getByText("1,211 · 4.5%")).toBeInTheDocument()
    expect(screen.queryByText("1211 · 4.5%")).not.toBeInTheDocument()
  })

  it("lets_available_bots_be_challenged_from_the_profile", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "randobotany",
      role: "bot",
      owner_email: "bot-random-any@kriegspiel.org",
      member_since: "2026-04-03T01:10:41Z",
      stats: {},
      user_metrics: { completed_games: 0 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })
    mockApi.getBots.mockResolvedValueOnce({
      bots: [
        {
          bot_id: "bot-random-any",
          username: "randobotany",
          display_name: "Random Any Bot (bot)",
          supported_rule_variants: ["berkeley_any", "wild16"],
        },
      ],
    })
    mockApi.createGame.mockResolvedValueOnce({ game_code: "ABCD12", state: "active" })

    renderProfile("/user/randobotany")

    await screen.findByRole("heading", { name: "randobotany" })
    await waitFor(() => expect(mockApi.getBots).toHaveBeenCalledWith({ profileUsername: "randobotany" }))
    const challengeCard = await screen.findByRole("region", { name: "Challenge this bot" })
    const recentGames = screen.getByRole("region", { name: "Recent games" })
    const documentPositionFollowing = 4

    expect(challengeCard.compareDocumentPosition(recentGames) & documentPositionFollowing).toBeTruthy()
    expect(within(challengeCard).getByRole("heading", { name: "Challenge this bot" })).toBeInTheDocument()
    expect(await within(challengeCard).findByRole("option", { name: "Berkeley + Any" })).toHaveValue("berkeley_any")
    expect(within(challengeCard).getByRole("option", { name: "Wild 16" })).toHaveValue("wild16")

    fireEvent.change(within(challengeCard).getByLabelText("Ruleset"), { target: { value: "wild16" } })
    fireEvent.click(within(challengeCard).getByRole("button", { name: "Play game" }))

    await waitFor(() => {
      expect(mockApi.createGame).toHaveBeenCalledWith({
        rule_variant: "wild16",
        play_as: "random",
        time_control: "rapid",
        opponent_type: "bot",
        bot_id: "bot-random-any",
      })
    })
    expect(await screen.findByRole("heading", { name: "Game route" })).toBeInTheDocument()
  })

  it("lets_catalog_hidden_mistral_nemo_be_challenged_from_the_profile", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_mistral_nemo",
      role: "bot",
      owner_email: "bots@kriegspiel.org",
      member_since: "2026-07-11T00:00:00Z",
      stats: {},
      user_metrics: { completed_games: 0 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })
    mockApi.getBots.mockResolvedValueOnce({
      bots: [
        {
          bot_id: "bot-mistral-nemo",
          username: "llm_mistral_nemo",
          display_name: "LLM Mistral Nemo (bot)",
          supported_rule_variants: ["berkeley", "berkeley_any"],
          available_for_viewer: true,
        },
      ],
    })
    mockApi.createGame.mockResolvedValueOnce({ game_code: "NEMO12", state: "active" })

    renderProfile("/user/llm_mistral_nemo")

    await screen.findByRole("heading", { name: "llm_mistral_nemo" })
    await waitFor(() => expect(mockApi.getBots).toHaveBeenCalledWith({ profileUsername: "llm_mistral_nemo" }))
    const challengeCard = await screen.findByRole("region", { name: "Challenge this bot" })
    await within(challengeCard).findByRole("option", { name: "Berkeley" })

    fireEvent.click(within(challengeCard).getByRole("button", { name: "Play game" }))

    await waitFor(() => {
      expect(mockApi.createGame).toHaveBeenCalledWith(expect.objectContaining({
        opponent_type: "bot",
        bot_id: "bot-mistral-nemo",
      }))
    })
  })

  it("points_to_subscription_when_a_bot_is_above_the_current_tier", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_gpt55",
      role: "bot",
      owner_email: "bot-gpt55@kriegspiel.org",
      member_since: "2026-04-03T01:10:41Z",
      stats: {},
      user_metrics: { completed_games: 0 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })
    mockApi.getBots.mockResolvedValueOnce({ bots: [] })

    renderProfile("/user/llm_gpt55")

    await screen.findByRole("heading", { name: "llm_gpt55" })
    const challengeCard = await screen.findByRole("region", { name: "Challenge this bot" })

    await within(challengeCard).findByText("llm_gpt55")
    expect(challengeCard).toHaveTextContent(/llm_gpt55 is available from T5Master\. Upgrade your tier to challenge this bot\./)
    expect(within(challengeCard).getByText("llm_gpt55")).toHaveClass("profile-challenge-upgrade__bot-name")
    const tierLink = within(challengeCard).getByRole("link", { name: "View Tier T5 Master subscription tier" })
    expect(tierLink).toHaveAttribute("href", "/subscription?tier=tier5")
    expect(within(tierLink).getByText("T5")).toHaveClass("tier-badge", "tier-badge--t5", "profile-challenge-upgrade__tier-code")
    expect(within(tierLink).getByText("Master")).toHaveClass("profile-challenge-upgrade__tier-name")
    expect(within(challengeCard).getByRole("link", { name: "View tiers" })).toHaveAttribute("href", "/subscription?tier=tier5")
    expect(within(challengeCard).queryByRole("button", { name: "Play game" })).not.toBeInTheDocument()
  })

  it("points_to_subscription_when_profile_bot_is_listed_but_unavailable_for_the_viewer", async () => {
    mockAuthState.value = {
      user: { username: "playerone", llm_bot_tier: "tier2" },
      convertGuest: vi.fn(),
      actionLoading: false,
    }
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_sonnet5",
      role: "bot",
      owner_email: "bot-sonnet5@kriegspiel.org",
      member_since: "2026-07-11T00:00:00Z",
      stats: {},
      user_metrics: { completed_games: 0 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })
    mockApi.getBots.mockResolvedValueOnce({
      bots: [
        {
          bot_id: "bot-sonnet5",
          username: "llm_sonnet5",
          display_name: "LLM Claude Sonnet 5 (bot)",
          required_tier: "tier3",
          available_for_viewer: false,
          supported_rule_variants: ["berkeley", "berkeley_any"],
        },
      ],
    })

    renderProfile("/user/llm_sonnet5")

    await screen.findByRole("heading", { name: "llm_sonnet5" })
    const challengeCard = await screen.findByRole("region", { name: "Challenge this bot" })

    await within(challengeCard).findByText("llm_sonnet5")
    expect(challengeCard).toHaveTextContent(/llm_sonnet5 is available from T3Strong\. Upgrade your tier to challenge this bot\./)
    expect(within(challengeCard).getByRole("link", { name: "View Tier T3 Strong subscription tier" })).toHaveAttribute("href", "/subscription?tier=tier3")
    expect(within(challengeCard).getByRole("link", { name: "View tiers" })).toHaveAttribute("href", "/subscription?tier=tier3")
    expect(within(challengeCard).queryByRole("button", { name: "Play game" })).not.toBeInTheDocument()
    expect(within(challengeCard).queryByLabelText("Ruleset")).not.toBeInTheDocument()
  })

  it("shows_user_metrics_for_human_profiles", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "fil",
      role: "user",
      llm_bot_tier: "tier2",
      member_since: "2026-01-01T00:00:00Z",
      stats: {},
      user_metrics: {
        completed_games: 2,
        average_duration_seconds: 540,
        average_turn_count: 12.5,
        overall: { total_games: 2, wins: 1, losses: 1, draws: 0, win_rate: 0.5 },
        vs_humans: { total_games: 1, wins: 1, losses: 0, draws: 0, win_rate: 1.0 },
        vs_bots: { total_games: 1, wins: 0, losses: 1, draws: 0, win_rate: 0.0 },
        as_white: { total_games: 1, wins: 0, losses: 1, draws: 0, win_rate: 0.0 },
        as_black: { total_games: 1, wins: 1, losses: 0, draws: 0, win_rate: 1.0 },
        opponents: [
          { username: "randobot", role: "bot", total_games: 1, wins: 0, losses: 1, draws: 0, win_rate: 0.0 },
        ],
        rulesets: [
          { rule_variant: "english", total_games: 1, wins: 1, losses: 0, draws: 0, win_rate: 1.0 },
        ],
      },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/fil")

    await screen.findByRole("heading", { name: "fil" })
    expect(screen.getByRole("heading", { name: "User metrics" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "This user is bot" })).not.toBeInTheDocument()
    expect(screen.getByText("Average turns count")).toBeInTheDocument()
    expect(screen.getByText("12.5")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "White" })).toHaveAttribute("href", "/user/fil/games?color=white")
    expect(screen.getByRole("link", { name: "randobot (bot)" })).toHaveAttribute("href", "/user/fil/games?opponent=randobot")
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute("href", "/user/fil/games?rule_set=english")
  })

  it("renders_higher_player_tiers_with_the_shared_tier_badge", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "master_player",
      role: "user",
      llm_bot_tier: "tier5",
      member_since: "2026-01-01T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/master_player")

    await screen.findByRole("heading", { name: "master_player" })
    const playerTier = screen.getByRole("region", { name: "Player tier" })
    expect(within(playerTier).getByRole("heading", { name: "Tier T5 Master" })).toBeInTheDocument()
    expect(within(playerTier).getByText("T5")).toHaveClass("tier-badge", "tier-badge--t5", "profile-tier-card__code")
  })

  it("shows_guest_conversion_section_for_own_guest_profile", async () => {
    const convertGuest = vi.fn().mockResolvedValue({ username: "adolf_adams" })
    mockAuthState.value = {
      user: { username: "guest_adolf_adams", is_guest: true },
      convertGuest,
      actionLoading: false,
    }
    mockApi.userApi.getProfile
      .mockResolvedValueOnce({
        username: "guest_adolf_adams",
        role: "guest",
        member_since: "2026-04-28T00:00:00Z",
        stats: {},
      })
      .mockResolvedValue({
        username: "adolf_adams",
        role: "user",
        member_since: "2026-04-28T00:00:00Z",
        stats: {},
      })
    mockApi.userApi.getGameHistory.mockResolvedValue({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValue({ series: { game: [], date: [] } })

    renderProfile("/user/guest_adolf_adams")

    await screen.findByRole("heading", { name: "guest_adolf_adams" })
    expect(screen.getByRole("heading", { name: "Keep this account." })).toBeInTheDocument()
    expect(screen.getByText(/You are currently playing Kriegspiel as a guest/i)).toBeInTheDocument()
    expect(screen.getByText("adolf_adams")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "player@example.com" } })
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Convert to regular account" }))

    await waitFor(() => {
      expect(convertGuest).toHaveBeenCalledWith({ email: "player@example.com", password: "secret123" })
    })
  })

  it("does_not_show_guest_conversion_section_on_other_guest_profiles", async () => {
    mockAuthState.value = {
      user: { username: "guest_judit_polgar", is_guest: true },
      convertGuest: vi.fn(),
      actionLoading: false,
    }
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "guest_adolf_adams",
      role: "guest",
      member_since: "2026-04-28T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/guest_adolf_adams")

    await screen.findByRole("heading", { name: "guest_adolf_adams" })
    expect(screen.queryByRole("heading", { name: "Keep this account." })).not.toBeInTheDocument()
  })

  it("shows_the_default_error_message_when_profile_loading_fails_without_details", async () => {
    mockApi.userApi.getProfile.mockRejectedValueOnce({})
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Unable to load profile.")
    })
  })

  it("marks_qwen_flash_bot_as_tier_three", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_qwen36_flash",
      role: "bot",
      member_since: "2026-07-04T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_qwen36_flash")

    await screen.findByRole("heading", { name: "llm_qwen36_flash" })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T3 Strong" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T3")).toHaveClass("tier-badge", "tier-badge--t3", "profile-tier-card__code")
    expect(screen.getByText("Qwen3.6 Flash model bot for T3 Strong.")).toBeInTheDocument()
  })

  it("marks_qwen_plus_bot_as_tier_two", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_qwen_plus",
      role: "bot",
      member_since: "2026-07-12T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_qwen_plus")

    await screen.findByRole("heading", { name: "llm_qwen_plus" })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T2 Club" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T2")).toHaveClass("tier-badge", "tier-badge--t2", "profile-tier-card__code")
    expect(screen.getByText("Qwen Plus model bot for T2 Club.")).toBeInTheDocument()
  })

  it.each([
    ["llm_qwen37_plus", "Tier T2 Club", "T2", "tier-badge--t2", "Qwen 3.7 Plus model bot for T2 Club."],
    ["llm_gpt56_luna", "Tier T3 Strong", "T3", "tier-badge--t3", "GPT-5.6 Luna model bot for T3 Strong (reasoning: no)."],
    ["llm_gpt56_terra", "Tier T4 Expert", "T4", "tier-badge--t4", "GPT-5.6 Terra model bot for T4 Expert (reasoning: no)."],
    ["llm_gpt55", "Tier T5 Master", "T5", "tier-badge--t5", "GPT-5.5 model bot for T5 Master (reasoning: no)."],
    ["llm_gpt56_sol", "Tier T5 Master", "T5", "tier-badge--t5", "GPT-5.6 Sol model bot for T5 Master (reasoning: no)."],
    ["llm_gpt55_pro", "Tier T5 Master", "T5", "tier-badge--t5", "GPT-5.5 Pro model bot for T5 Master (reasoning: medium)."],
  ])("marks_%s_with_the_configured_llm_tier", async (username, heading, code, badgeClass, description) => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username,
      role: "bot",
      member_since: "2026-07-12T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile(`/user/${username}`)

    await screen.findByRole("heading", { name: username })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText(code)).toHaveClass("tier-badge", badgeClass, "profile-tier-card__code")
    expect(screen.getByText(description)).toBeInTheDocument()
    expect(screen.queryByText(/Default reasoning level:/)).not.toBeInTheDocument()
  })

  it("marks_nemotron_ultra_bot_as_tier_three", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_nemotron_ultra",
      role: "bot",
      member_since: "2026-07-10T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_nemotron_ultra")

    await screen.findByRole("heading", { name: "llm_nemotron_ultra" })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T3 Strong" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T3")).toHaveClass("tier-badge", "tier-badge--t3", "profile-tier-card__code")
    expect(screen.getByText("Nemotron Ultra model bot for T3 Strong.")).toBeInTheDocument()
  })

  it("marks_mistral_large3_bot_as_tier_three", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_mistral_large3",
      role: "bot",
      member_since: "2026-07-11T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_mistral_large3")

    await screen.findByRole("heading", { name: "llm_mistral_large3" })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T3 Strong" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T3")).toHaveClass("tier-badge", "tier-badge--t3", "profile-tier-card__code")
    expect(screen.getByText("Mistral Large 3 model bot for T3 Strong.")).toBeInTheDocument()
  })

  it.each([
    ["randobot", "Tier T0 Random Bot", "T0", "tier-badge--t0", "Random Bot for T0 Guest."],
    ["randobotany", "Tier T0 Random Any Bot", "T0", "tier-badge--t0", "Random Any Bot for T0 Guest."],
    ["simpleheuristics", "Tier T1 Simple Heuristics Bot", "T1", "tier-badge--t1", "Simple Heuristics Bot for T1 Casual."],
    ["stockfishwild", "Tier T1 Stockfish Wild 16", "T1", "tier-badge--t1", "Stockfish Wild 16 bot for T1 Casual."],
  ])("marks_%s_with_the_non_llm_bot_tier", async (username, heading, code, tierClass, copy) => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username,
      role: "bot",
      llm_bot_tier: null,
      member_since: "2026-04-11T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile(`/user/${username}`)

    await screen.findByRole("heading", { name: username })
    const botTier = screen.getByRole("region", { name: "Bot tier" })
    expect(within(botTier).getByRole("link", { name: `Bot tier: ${heading}. View subscription options` })).toHaveAttribute("href", "/subscription")
    expect(within(botTier).getByRole("heading", { name: heading })).toBeInTheDocument()
    expect(within(botTier).getByText(code)).toHaveClass("tier-badge", tierClass, "profile-tier-card__code")
    expect(within(botTier).getByText(copy)).toBeInTheDocument()
  })

  it.each([
    "openrouterbot",
    "probebotnoemail",
    "randobot_e2e1ebjq1",
    "randobot_e2euvbdsb",
  ])("marks_%s_as_a_deactivated_bot_tier", async (username) => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username,
      role: "bot",
      llm_bot_tier: null,
      member_since: "2026-07-11T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile(`/user/${username}`)

    await screen.findByRole("heading", { name: username })
    const botTier = screen.getByRole("region", { name: "Bot tier" })
    expect(within(botTier).getByRole("heading", { name: "Tier TD Deactivated" })).toBeInTheDocument()
    expect(within(botTier).getByText("TD")).toHaveClass("tier-badge", "tier-badge--td", "profile-tier-card__code")
    expect(within(botTier).getByText("Deactivated bot account.")).toBeInTheDocument()
  })

  it("marks_darkboard_mcts_as_a_tier_one_bot", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "darkboardmcts",
      role: "bot",
      member_since: "2026-05-18T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/darkboardmcts")

    await screen.findByRole("heading", { name: "darkboardmcts" })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T1 MCTS bot" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T1")).toHaveClass("tier-badge", "tier-badge--t1", "profile-tier-card__code")
    expect(screen.getByText("Darkboard MCTS bot for T1 Casual.")).toBeInTheDocument()
  })

  it("marks_qwen_max_bot_as_tier_five", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_qwen37_max",
      role: "bot",
      member_since: "2026-07-06T00:00:00Z",
      stats: {},
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_qwen37_max")

    await screen.findByRole("heading", { name: "llm_qwen37_max" })
    expect(screen.getByRole("region", { name: "Bot tier" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T5 Master" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Bot tier" })).getByText("T5")).toHaveClass("tier-badge", "tier-badge--t5", "profile-tier-card__code")
    expect(screen.getByText("Qwen 3.7 Max model bot for T5 Master.")).toBeInTheDocument()
  })

  it("renders_gptnano_bot_profile_with_the_shared_tier_badge", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_gptnano",
      role: "bot",
      llm_bot_tier: null,
      owner_email: "bot-gpt-nano@kriegspiel.org",
      member_since: "2026-04-03T01:10:41Z",
      stats: {},
      user_metrics: { completed_games: 0 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({ games: [] })
    mockApi.userApi.getRatingHistory.mockResolvedValueOnce({ series: { game: [], date: [] } })

    renderProfile("/user/llm_gptnano")

    await screen.findByRole("heading", { name: "llm_gptnano" })
    const botTier = screen.getByRole("region", { name: "Bot tier" })
    expect(within(botTier).getByRole("heading", { name: "Tier T2 Club" })).toBeInTheDocument()
    expect(within(botTier).getByText("T2")).toHaveClass("tier-badge", "tier-badge--t2", "profile-tier-card__code")
    expect(screen.getByText("GPT-5.4 Nano model bot for T2 Club.")).toBeInTheDocument()
    expect(within(botTier).queryByText(/Default reasoning level:/)).not.toBeInTheDocument()
  })

  it("falls_back_to_unknown_bot_values_and_recent_game_labels", async () => {
    mockApi.userApi.getProfile.mockResolvedValueOnce({
      username: "llm_haiku",
      is_bot: true,
      owner_email: null,
      member_since: null,
      stats: {},
      user_metrics: { completed_games: 0 },
    })
    mockApi.userApi.getGameHistory.mockResolvedValueOnce({
      games: [
        {
          game_id: "g-3",
          result: "draw",
          opponent: null,
        },
      ],
    })
    mockApi.userApi.getRatingHistory.mockRejectedValueOnce(new Error("history failed"))

    renderProfile("/user/llm_haiku")

    await screen.findByRole("heading", { name: "llm_haiku" })
    expect(screen.getByText("Member since Unknown.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Tier T2 Club" })).toBeInTheDocument()
    expect(screen.getByText("Claude Haiku 4.5 model bot for T2 Club.")).toBeInTheDocument()
    expect(screen.getByText(/Email address of this bot owner is unknown\./i)).toBeInTheDocument()
    expect(screen.getByText("No completed games yet.")).toBeInTheDocument()
    expect(screen.getByText(/draw vs unknown/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "View all games" })).toHaveAttribute("href", "/user/llm_haiku/games")
  })
})
