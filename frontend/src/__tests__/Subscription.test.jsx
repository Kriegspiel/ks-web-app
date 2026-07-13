import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import SubscriptionPage from "../pages/Subscription"
import { TEST_VERSION_STAMP } from "../version"

const mockAuth = vi.hoisted(() => ({
  user: { username: "playerone", is_guest: false },
  isAuthenticated: true,
  bootstrapping: false,
}))

const mockBillingApi = vi.hoisted(() => ({
  getSubscription: vi.fn(),
  createCheckoutSession: vi.fn(),
  createSubscriptionChangeSession: vi.fn(),
  createPortalSession: vi.fn(),
}))
const mockGetBots = vi.hoisted(() => vi.fn())

const stripeMount = vi.hoisted(() => vi.fn())
const stripeDestroy = vi.hoisted(() => vi.fn())
const createEmbeddedCheckoutPage = vi.hoisted(() => vi.fn())
const originalScrollTo = window.scrollTo

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}))

vi.mock("../services/api", () => ({
  billingApi: mockBillingApi,
  getBots: mockGetBots,
}))

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: vi.fn(() => Promise.resolve({ createEmbeddedCheckoutPage })),
}))

function billingStatus(overrides = {}) {
  return {
    enabled: true,
    publishable_key: "pk_test_123",
    current_tier: "tier1",
    available_prices: {
      tier2: { monthly: true, yearly: true },
      tier3: { monthly: true, yearly: true },
      tier4: { monthly: true, yearly: true },
    },
    billing: { has_customer: false, subscription_status: null, tier: null, interval: null },
    ...overrides,
  }
}

function renderPage(initialEntry = "/subscription") {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SubscriptionPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  window.scrollTo = vi.fn()
  mockAuth.user = { username: "playerone", is_guest: false }
  mockAuth.isAuthenticated = true
  mockAuth.bootstrapping = false
  mockBillingApi.getSubscription.mockReset()
  mockBillingApi.createCheckoutSession.mockReset()
  mockBillingApi.createSubscriptionChangeSession.mockReset()
  mockBillingApi.createPortalSession.mockReset()
  mockGetBots.mockReset()
  stripeMount.mockReset()
  stripeDestroy.mockReset()
  createEmbeddedCheckoutPage.mockReset()
  mockBillingApi.getSubscription.mockResolvedValue(billingStatus())
  mockBillingApi.createCheckoutSession.mockResolvedValue({ client_secret: "cs_test_123" })
  mockBillingApi.createSubscriptionChangeSession.mockResolvedValue({ url: "#stripe-subscription-change" })
  mockBillingApi.createPortalSession.mockResolvedValue({ url: "https://billing.example/session" })
  mockGetBots.mockRejectedValue(new Error("Unable to load bots right now."))
  createEmbeddedCheckoutPage.mockImplementation(async ({ fetchClientSecret }) => {
    const clientSecret = await fetchClientSecret()
    return { clientSecret, mount: stripeMount, destroy: stripeDestroy }
  })
})

afterEach(() => {
  window.scrollTo = originalScrollTo
  window.history.replaceState(null, "", "/")
  cleanup()
})

describe("SubscriptionPage", () => {
  it("renders_a_public_signup_invite_without_billing_state_for_unauthenticated_visitors", async () => {
    mockAuth.user = null
    mockAuth.isAuthenticated = false

    renderPage()

    await screen.findByRole("heading", { name: "Subscription" })
    const invite = await screen.findByRole("region", { name: "Start free" })
    expect(within(invite).getByRole("heading", { name: "Create a profile and start playing." })).toBeInTheDocument()
    expect(within(invite).getByText(/The free Casual level already includes human games/i)).toBeInTheDocument()
    expect(within(invite).getByRole("link", { name: "Create free profile" })).toHaveAttribute("href", "/auth/register")
    expect(within(invite).getByRole("link", { name: "Start playing" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("rowheader", { name: "Play human games" })).toBeInTheDocument()
    expect(screen.getByRole("rowheader", { name: "Play bots" })).toBeInTheDocument()
    expect(screen.queryByText("Current level")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Manage billing (opens external website)" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Subscription controls" })).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Stripe payment form")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Open payment form" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Choose Tier T2 Club" })).not.toBeInTheDocument()
    expect(mockBillingApi.getSubscription).not.toHaveBeenCalled()
    expect(mockGetBots).not.toHaveBeenCalled()
  })

  it("renders_the_tier_table_and_mounts_embedded_checkout_for_the_selected_plan", async () => {
    renderPage()

    await screen.findByRole("heading", { name: "Subscription" })
    expect(screen.getByRole("button", { name: "Manage billing (opens external website)" })).toHaveTextContent(/Manage billing\s*↗/)
    const currentTierHeader = screen.getByText("Current level").closest("th")
    expect(currentTierHeader).toHaveAttribute("aria-current", "true")
    expect(currentTierHeader).toHaveTextContent("Casual")
    const documentPositionFollowing = 4
    expect(within(currentTierHeader).getByText("Free").compareDocumentPosition(within(currentTierHeader).getByText("Current level")) & documentPositionFollowing).toBeTruthy()
    const controls = screen.getByRole("region", { name: "Subscription controls" })
    expect(within(controls).getByText("$10/mo").compareDocumentPosition(within(controls).getByText("$100/yr")) & documentPositionFollowing).toBeTruthy()
    expect(within(controls).queryByText("$10/mo / $100/yr")).not.toBeInTheDocument()
    const tier2Header = screen.getByText("Club").closest("th")
    expect(within(tier2Header).getByText("$10/mo").compareDocumentPosition(within(tier2Header).getByText("$100/yr")) & documentPositionFollowing).toBeTruthy()
    expect(within(tier2Header).queryByText("$10/mo / $100/yr")).not.toBeInTheDocument()
    const rowHeaders = screen.getAllByRole("rowheader").map((cell) => cell.textContent)
    expect(rowHeaders.slice(0, 4)).toEqual(["Play human games", "Completed-game review", "Rating history", "Play bots"])
    const humanGamesRow = screen.getByRole("rowheader", { name: "Play human games" }).closest("tr")
    expect(within(humanGamesRow).getAllByText("Yes")).toHaveLength(7)
    const reviewRow = screen.getByRole("rowheader", { name: "Completed-game review" }).closest("tr")
    expect(within(reviewRow).getAllByText("Yes")).toHaveLength(7)
    const ratingHistoryRow = screen.getByRole("rowheader", { name: "Rating history" }).closest("tr")
    expect(within(ratingHistoryRow).getAllByText("Yes")).toHaveLength(7)
    const persistentNameRow = screen.getByRole("rowheader", { name: "Persistent player name" }).closest("tr")
    expect(within(persistentNameRow).getByText("No")).toBeInTheDocument()
    expect(within(persistentNameRow).getAllByText("Yes")).toHaveLength(6)
    expect(within(persistentNameRow).queryByText("Not available")).not.toBeInTheDocument()
    expect(screen.getByRole("rowheader", { name: "Play bots" })).toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Play simple bots" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Play T2 bots" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Play T3 bots" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Play T4 bots" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Play T5 bots" })).not.toBeInTheDocument()
    const playBotsRow = screen.getByRole("rowheader", { name: "Play bots" }).closest("tr")
    const botCells = within(playBotsRow).getAllByRole("cell")
    expect(botCells).toHaveLength(7)
    expect(within(botCells[0]).getByText("Kriegspiel:")).toBeInTheDocument()
    expect(within(botCells[0]).getByRole("link", { name: "Random Bot" })).toHaveAttribute("href", "/user/randobot")
    expect(within(botCells[0]).getByRole("link", { name: "Random Any" })).toHaveAttribute("href", "/user/randobotany")
    expect(within(botCells[0]).getAllByRole("listitem")).toHaveLength(2)
    expect(within(botCells[0]).queryByRole("link", { name: "Darkboard MCTS" })).not.toBeInTheDocument()
    expect(within(botCells[0]).queryByText("Lower-tier bots included.")).not.toBeInTheDocument()
    expect(within(botCells[1]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[1]).getByRole("link", { name: "Darkboard MCTS" })).toHaveAttribute("href", "/user/darkboardmcts")
    expect(within(botCells[1]).getByRole("link", { name: "Simple Heuristics Bot" })).toHaveAttribute("href", "/user/simpleheuristics")
    expect(within(botCells[1]).getByRole("link", { name: "Stockfish Wild 16" })).toHaveAttribute("href", "/user/stockfishwild")
    expect(within(botCells[1]).queryByRole("link", { name: "Random Bot" })).not.toBeInTheDocument()
    expect(within(botCells[2]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[2]).getByText("OpenAI:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "GPT Nano" })).toHaveAttribute("href", "/user/llm_gptnano")
    expect(within(botCells[2]).getByRole("link", { name: "GPT-OSS 120B" })).toHaveAttribute("href", "/user/llm_gptoss120b")
    expect(within(botCells[2]).getByText("Anthropic:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Claude Haiku" })).toHaveAttribute("href", "/user/llm_haiku")
    expect(within(botCells[2]).getByText("DeepSeek:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "DeepSeek V3.2" })).toHaveAttribute("href", "/user/llm_deepseek_v32")
    expect(within(botCells[2]).getByText("Mistral AI:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Mistral Small 3.2" })).toHaveAttribute("href", "/user/llm_mistral_small32")
    expect(within(botCells[2]).queryByRole("link", { name: "Mistral Nemo" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Mistral Large 3" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Nemotron Ultra" })).not.toBeInTheDocument()
    expect(within(botCells[2]).getByText("Meta:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Llama 4 Maverick" })).toHaveAttribute("href", "/user/llm_llama4_maverick")
    expect(within(botCells[2]).queryByRole("link", { name: "Llama 3.1 8B" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Llama 4 Scout" })).not.toBeInTheDocument()
    expect(within(botCells[2]).getByText("Google:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Gemma 4 31B" })).toHaveAttribute("href", "/user/llm_gemma4_31b")
    expect(within(botCells[2]).queryByRole("link", { name: "Gemma 3 4B" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Gemma 3 27B" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Gemini 2.5 Flash-Lite" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Gemini 3.1 Flash-Lite" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Nano" })).not.toBeInTheDocument()
    expect(within(botCells[2]).getByText("Nvidia:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Nemotron Super" })).toHaveAttribute("href", "/user/llm_nemotron_super")
    expect(within(botCells[2]).getByText("Alibaba:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Qwen Plus" })).toHaveAttribute("href", "/user/llm_qwen_plus")
    expect(within(botCells[2]).getByRole("link", { name: "Qwen 3.7 Plus" })).toHaveAttribute("href", "/user/llm_qwen37_plus")
    expect(within(botCells[2]).getByText("MiniMax:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "MiniMax M3" })).toHaveAttribute("href", "/user/llm_minimax_m3")
    expect(within(botCells[2]).queryByRole("link", { name: "Simple Heuristics Bot" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByText(/Default reasoning level:/)).not.toBeInTheDocument()
    expect(within(botCells[3]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "GPT-5.6 Luna" })).toHaveAttribute("href", "/user/llm_gpt56_luna")
    expect(within(botCells[3]).queryByText(/reasoning: no/i)).not.toBeInTheDocument()
    expect(within(botCells[3]).queryByText(/Default reasoning level:/)).not.toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Claude Sonnet 5" })).toHaveAttribute("href", "/user/llm_sonnet5")
    expect(within(botCells[3]).queryByRole("link", { name: "GPT-5.5" })).not.toBeInTheDocument()
    expect(within(botCells[3]).queryByText("xAI:")).not.toBeInTheDocument()
    expect(within(botCells[3]).queryByRole("link", { name: "Grok 4.5" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Gemini 3.1 Flash-Lite" })).toHaveAttribute("href", "/user/llm_gemini31_lite")
    expect(within(botCells[3]).getByRole("link", { name: "Gemini 3.5 Flash" })).toHaveAttribute("href", "/user/llm_gemini35_flash")
    expect(within(botCells[3]).queryByRole("link", { name: "Gemini 2.5 Flash" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByText("Mistral AI:")).toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Mistral Large 3" })).toHaveAttribute("href", "/user/llm_mistral_large3")
    expect(within(botCells[3]).getByRole("link", { name: "Mistral Medium 3.5" })).toHaveAttribute("href", "/user/llm_mistral_medium35")
    expect(within(botCells[3]).queryByRole("link", { name: "Mistral Nemo" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Nemotron Ultra" })).toHaveAttribute("href", "/user/llm_nemotron_ultra")
    expect(within(botCells[3]).getByRole("link", { name: "Qwen 3.6 Flash" })).toHaveAttribute("href", "/user/llm_qwen36_flash")
    expect(within(botCells[3]).queryByRole("link", { name: "Qwen Plus" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Kimi K2 Thinking" })).toHaveAttribute("href", "/user/llm_kimi_k2_thinking")
    expect(within(botCells[3]).getByRole("link", { name: "Hermes 3 70B" })).toHaveAttribute("href", "/user/llm_hermes3_70b")
    expect(within(botCells[4]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[4]).getByRole("link", { name: "Claude Opus 4.8" })).toHaveAttribute("href", "/user/llm_opus48")
    expect(within(botCells[4]).getByRole("link", { name: "GPT-5.6 Terra" })).toHaveAttribute("href", "/user/llm_gpt56_terra")
    expect(within(botCells[4]).queryByText(/Default reasoning level:/)).not.toBeInTheDocument()
    expect(within(botCells[4]).getByRole("link", { name: "DeepSeek V4 Pro" })).toHaveAttribute("href", "/user/bot_deepseekv4_pro")
    expect(within(botCells[4]).getByRole("link", { name: "Gemini 3.1 Pro Preview" })).toHaveAttribute("href", "/user/llm_gemini31_pro_preview")
    expect(within(botCells[4]).getByRole("link", { name: "GLM 5.2" })).toHaveAttribute("href", "/user/llm_glm52")
    expect(within(botCells[4]).getByRole("link", { name: "Kimi K2.7 Code" })).toHaveAttribute("href", "/user/llm_kimi_k27_code")
    expect(within(botCells[4]).getByRole("link", { name: "Hermes 4 405B" })).toHaveAttribute("href", "/user/llm_hermes4_405b")
    expect(within(botCells[5]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[5]).getByRole("link", { name: "GPT-5.6 Sol" })).toHaveAttribute("href", "/user/llm_gpt56_sol")
    expect(within(botCells[5]).getByRole("link", { name: "GPT-5.5" })).toHaveAttribute("href", "/user/llm_gpt55")
    expect(within(botCells[5]).getByRole("link", { name: "GPT-5.5 Pro (reasoning: medium)" })).toHaveAttribute("href", "/user/llm_gpt55_pro")
    expect(within(botCells[5]).queryByText(/Default reasoning level:/)).not.toBeInTheDocument()
    expect(within(botCells[5]).queryByText(/reasoning: no/i)).not.toBeInTheDocument()
    expect(within(botCells[5]).getByText("xAI:")).toBeInTheDocument()
    expect(within(botCells[5]).getByRole("link", { name: "Grok 4.5" })).toHaveAttribute("href", "/user/llm_grok45")
    expect(within(botCells[5]).getByRole("link", { name: "Qwen 3.7 Max" })).toHaveAttribute("href", "/user/llm_qwen37_max")
    expect(screen.queryByRole("link", { name: "GPTNano T2" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "GPT-5.6 Luna T3" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "GPT-5.6 Terra T4" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "GPT-5.5 Pro T5" })).not.toBeInTheDocument()
    const customLlmRow = screen.getByRole("rowheader", { name: "Custom LLM providers and strategies" }).closest("tr")
    const customLlmCells = within(customLlmRow).getAllByRole("cell")
    expect(customLlmCells.slice(0, 5).map((cell) => cell.textContent)).toEqual(["No", "No", "No", "No", "No"])
    expect(customLlmCells[5]).toHaveTextContent("New LLM providers by request.")
    expect(customLlmCells[6]).toHaveTextContent("New LLMs by request and fully customizable strategies and prompts.")
    expect(screen.getByRole("heading", { name: "Why subscriptions help" })).toBeInTheDocument()
    expect(screen.getByText(/The free T1 level covers almost everything most players need/i)).toBeInTheDocument()
    expect(screen.getByText(/bring more challenge, variety, and joy/i)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Bot availability" })).toBeInTheDocument()
    expect(screen.getByText(/provider downtime, API limits, or temporary service issues/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "any@kriegspiel.org" })).toHaveAttribute(
      "href",
      "mailto:any@kriegspiel.org",
    )
    expect(screen.getByRole("link", { name: "X.com (@kriegspiel_org)" })).toHaveAttribute("href", "https://x.com/kriegspiel_org")
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Public player profile" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Leaderboard eligibility" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Choose Tier/i })).not.toBeInTheDocument()

    const strongHumanGamesCell = within(humanGamesRow).getAllByRole("cell")[3]
    await waitFor(() => {
      expect(strongHumanGamesCell).toHaveClass("subscription-tier-table__selectable-column")
    })
    fireEvent.click(strongHumanGamesCell)
    expect(screen.getByText("Current level").closest("th")).toHaveTextContent("Casual")
    await waitFor(() => {
      expect(within(controls).getByRole("heading", { name: "Tier T3 Strong" })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Yearly" })).toHaveClass("is-active")
    })
    fireEvent.click(screen.getByRole("button", { name: "Open payment form" }))

    await waitFor(() => {
      expect(mockBillingApi.createCheckoutSession).toHaveBeenCalledWith({ tier: "tier3", interval: "yearly" })
    })
    expect(createEmbeddedCheckoutPage).toHaveBeenCalledTimes(1)
    expect(stripeMount).toHaveBeenCalledTimes(1)
    expect(stripeMount.mock.calls[0][0]).toBeInstanceOf(HTMLElement)
  })

  it("uses_the_live_signed_in_bot_list_when_available", async () => {
    mockGetBots.mockResolvedValueOnce({
      bots: [
        { bot_id: "bot-random", username: "randobot", display_name: "Random Bot", elo: 1200 },
        { bot_id: "bot-grok", username: "llm_grok45", display_name: "LLM Grok 4.5 (bot)", elo: 1201, llm_backed: true, required_tier: "tier5" },
        { bot_id: "bot-qwen", username: "llm_qwen37_max", display_name: "LLM Qwen 3.7 Max (bot)", elo: 1227, llm_backed: true, required_tier: "tier5" },
      ],
    })

    renderPage()

    const playBotsRow = await screen.findByRole("rowheader", { name: "Play bots" }).then((row) => row.closest("tr"))
    const botCells = within(playBotsRow).getAllByRole("cell")
    expect(botCells).toHaveLength(7)

    await waitFor(() => {
      expect(within(botCells[5]).queryByText("OpenAI:")).not.toBeInTheDocument()
    })
    expect(within(botCells[5]).getByRole("link", { name: "Grok 4.5" })).toHaveAttribute("href", "/user/llm_grok45")
    expect(within(botCells[5]).getByText("xAI:")).toBeInTheDocument()
    expect(within(botCells[5]).getByRole("link", { name: "Qwen 3.7 Max" })).toHaveAttribute("href", "/user/llm_qwen37_max")
    expect(within(botCells[5]).getByText("Alibaba:")).toBeInTheDocument()
    expect(within(botCells[5]).queryByRole("link", { name: "1201 - LLM Grok 4.5" })).not.toBeInTheDocument()
    expect(within(botCells[5]).queryByRole("link", { name: "1227 - LLM Qwen 3.7 Max" })).not.toBeInTheDocument()
    expect(within(botCells[5]).queryByText("T5 Master bots:")).not.toBeInTheDocument()
    expect(within(botCells[5]).queryByRole("link", { name: "GPT-5.5" })).not.toBeInTheDocument()
    expect(within(botCells[5]).queryByText(/No LLM bots/i)).not.toBeInTheDocument()
    expect(within(botCells[6]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(mockGetBots).toHaveBeenCalledTimes(1)
  })

  it("uses_the_tier_query_param_as_the_initial_selected_plan", async () => {
    renderPage("/subscription?tier=tier3")

    const controls = await screen.findByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T3 Strong" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /Tier\s+T3\s+Strong/i })).toHaveClass("subscription-tier-table__selected-column")

    fireEvent.click(screen.getByRole("button", { name: "Open payment form" }))

    await waitFor(() => {
      expect(mockBillingApi.createCheckoutSession).toHaveBeenCalledWith({ tier: "tier3", interval: "monthly" })
    })
  })

  it("does_not_select_a_tier_when_a_bot_link_inside_the_column_is_clicked", async () => {
    renderPage("/subscription?tier=tier4")

    const controls = await screen.findByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T4 Expert" })).toBeInTheDocument()

    const playBotsRow = await screen.findByRole("rowheader", { name: "Play bots" }).then((row) => row.closest("tr"))
    const botCells = within(playBotsRow).getAllByRole("cell")
    const sonnetLink = within(botCells[3]).getByRole("link", { name: "Claude Sonnet 5" })
    sonnetLink.addEventListener("click", (event) => event.preventDefault(), { once: true })
    fireEvent.click(sonnetLink)

    expect(within(controls).getByRole("heading", { name: "Tier T4 Expert" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /Tier\s+T3\s+Strong/i })).not.toHaveClass("subscription-tier-table__selected-column")
    expect(screen.getByRole("columnheader", { name: /Tier\s+T4\s+Expert/i })).toHaveClass("subscription-tier-table__selected-column")
  })

  it("scrolls_to_the_top_when_opened_with_a_preselected_tier", async () => {
    document.documentElement.scrollTop = 640
    document.body.scrollTop = 640

    renderPage("/subscription?tier=tier4")

    const controls = await screen.findByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T4 Expert" })).toBeInTheDocument()
    expect(screen.getByRole("columnheader", { name: /Tier\s+T4\s+Expert/i })).toHaveClass("subscription-tier-table__selected-column")
    expect(document.documentElement.scrollTop).toBe(0)
    expect(document.body.scrollTop).toBe(0)
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: "auto" })
  })

  it("uses_a_t5_tier_query_param_as_the_initial_unavailable_selection", async () => {
    renderPage("/subscription?tier=tier5")

    const controls = await screen.findByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T5 Master" })).toBeInTheDocument()
    expect(within(controls).getByText("Not available yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open payment form" })).toBeDisabled()
    expect(screen.queryByRole("button", { name: "Choose Tier T5 Master" })).not.toBeInTheDocument()

    const tier5Header = screen.getByRole("columnheader", { name: /Tier\s+T5\s+Master/i })
    expect(tier5Header).toHaveClass("subscription-tier-table__selected-column")
    expect(tier5Header).toHaveClass("subscription-tier-table__unavailable-column")
    expect(mockBillingApi.createCheckoutSession).not.toHaveBeenCalled()
  })

  it("uses_the_current_paid_tier_as_the_initial_selection", async () => {
    mockBillingApi.getSubscription.mockResolvedValueOnce(billingStatus({ current_tier: "tier4" }))

    renderPage()

    await screen.findByRole("heading", { name: "Subscription" })
    const controls = screen.getByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T4 Expert" })).toBeInTheDocument()
  })

  it("opens_a_prorated_subscription_change_review_for_active_subscribers", async () => {
    mockBillingApi.getSubscription.mockResolvedValueOnce(billingStatus({
      current_tier: "tier2",
      billing: {
        has_customer: true,
        subscription_status: "active",
        tier: "tier2",
        interval: "monthly",
      },
    }))

    renderPage()

    const controls = await screen.findByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T2 Club" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Current subscription" })).toBeDisabled()

    const humanGamesRow = screen.getByRole("rowheader", { name: "Play human games" }).closest("tr")
    fireEvent.click(within(humanGamesRow).getAllByRole("cell")[3])

    await waitFor(() => {
      expect(within(controls).getByRole("heading", { name: "Tier T3 Strong" })).toBeInTheDocument()
    })
    const changeButton = screen.getByRole("button", { name: "Review prorated change" })
    expect(changeButton).toBeEnabled()
    fireEvent.click(changeButton)

    await waitFor(() => {
      expect(mockBillingApi.createSubscriptionChangeSession).toHaveBeenCalledWith({ tier: "tier3", interval: "monthly" })
    })
    expect(mockBillingApi.createCheckoutSession).not.toHaveBeenCalled()
    expect(stripeMount).not.toHaveBeenCalled()
    expect(window.location.hash).toBe("#stripe-subscription-change")
  })

  it("asks_guest_accounts_to_convert_before_subscribing", async () => {
    mockAuth.user = { username: "guest_adolf_adams", is_guest: true }

    renderPage()

    await screen.findByRole("heading", { name: "Subscription" })
    const guestNotice = screen.getByRole("region", { name: "Guest subscription notice" })
    expect(guestNotice).toHaveClass("subscription-notice--warning")
    expect(screen.getByRole("link", { name: "profile" })).toHaveAttribute("href", "/user/guest_adolf_adams")
    expect(screen.getByRole("button", { name: "Open payment form" })).toBeDisabled()
  })
})
