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
  createPortalSession: vi.fn(),
}))

const stripeMount = vi.hoisted(() => vi.fn())
const stripeDestroy = vi.hoisted(() => vi.fn())
const createEmbeddedCheckoutPage = vi.hoisted(() => vi.fn())

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => mockAuth,
}))

vi.mock("../services/api", () => ({
  billingApi: mockBillingApi,
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

function renderPage() {
  render(
    <MemoryRouter>
      <SubscriptionPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  cleanup()
  mockAuth.user = { username: "playerone", is_guest: false }
  mockAuth.isAuthenticated = true
  mockAuth.bootstrapping = false
  mockBillingApi.getSubscription.mockReset()
  mockBillingApi.createCheckoutSession.mockReset()
  mockBillingApi.createPortalSession.mockReset()
  stripeMount.mockReset()
  stripeDestroy.mockReset()
  createEmbeddedCheckoutPage.mockReset()
  mockBillingApi.getSubscription.mockResolvedValue(billingStatus())
  mockBillingApi.createCheckoutSession.mockResolvedValue({ client_secret: "cs_test_123" })
  mockBillingApi.createPortalSession.mockResolvedValue({ url: "https://billing.example/session" })
  createEmbeddedCheckoutPage.mockImplementation(async ({ fetchClientSecret }) => {
    const clientSecret = await fetchClientSecret()
    return { clientSecret, mount: stripeMount, destroy: stripeDestroy }
  })
})

afterEach(() => {
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
    expect(within(botCells[0]).getByText("T0-level bots:")).toBeInTheDocument()
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
    expect(within(botCells[2]).getByText("T2 OpenAI:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "GPTNano" })).toHaveAttribute("href", "/user/llm_gptnano")
    expect(within(botCells[2]).getByRole("link", { name: "GPT-OSS" })).toHaveAttribute("href", "/user/llm_gptoss120b")
    expect(within(botCells[2]).getByText("T2 Anthropic:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Claude Haiku" })).toHaveAttribute("href", "/user/llm_haiku")
    expect(within(botCells[2]).getByText("T2 Mistral:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "Small 3.2" })).toHaveAttribute("href", "/user/llm_mistral_small32")
    expect(within(botCells[2]).queryByRole("link", { name: "Nemo" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Large 3" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Ultra" })).not.toBeInTheDocument()
    expect(within(botCells[2]).getByText("T2 Llama:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "4 Maverick" })).toHaveAttribute("href", "/user/llm_llama4_maverick")
    expect(within(botCells[2]).queryByRole("link", { name: "3.1 8B" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "4 Scout" })).not.toBeInTheDocument()
    expect(within(botCells[2]).getByText("T2 Gemma:")).toBeInTheDocument()
    expect(within(botCells[2]).getByRole("link", { name: "4 31B" })).toHaveAttribute("href", "/user/llm_gemma4_31b")
    expect(within(botCells[2]).queryByRole("link", { name: "3 4B" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "3 27B" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByText("T2 Gemini:")).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "2.5 Flash-Lite" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "3.1 Flash-Lite" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Nano" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Super" })).toHaveAttribute("href", "/user/llm_nemotron_super")
    expect(within(botCells[2]).queryByRole("link", { name: "Simple Heuristics Bot" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "GPT-5.5" })).toHaveAttribute("href", "/user/llm_gpt55")
    expect(within(botCells[3]).getByRole("link", { name: "Claude Sonnet 5" })).toHaveAttribute("href", "/user/llm_sonnet5")
    expect(within(botCells[3]).getByRole("link", { name: "3.1 Flash-Lite" })).toHaveAttribute("href", "/user/llm_gemini31_lite")
    expect(within(botCells[3]).queryByRole("link", { name: "2.5 Flash" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByText("T3 Mistral:")).toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Large 3" })).toHaveAttribute("href", "/user/llm_mistral_large3")
    expect(within(botCells[3]).queryByRole("link", { name: "Nemo" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Ultra" })).toHaveAttribute("href", "/user/llm_nemotron_ultra")
    expect(within(botCells[3]).getByRole("link", { name: "3.6 Flash" })).toHaveAttribute("href", "/user/llm_qwen36_flash")
    expect(within(botCells[3]).getByRole("link", { name: "Plus" })).toHaveAttribute("href", "/user/llm_qwen_plus")
    expect(within(botCells[3]).getByRole("link", { name: "K2 Thinking" })).toHaveAttribute("href", "/user/llm_kimi_k2_thinking")
    expect(within(botCells[3]).getByRole("link", { name: "3 70B" })).toHaveAttribute("href", "/user/llm_hermes3_70b")
    expect(within(botCells[4]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[4]).getByRole("link", { name: "Claude Opus 4.8" })).toHaveAttribute("href", "/user/llm_opus48")
    expect(within(botCells[4]).getByRole("link", { name: "V4 Pro" })).toHaveAttribute("href", "/user/bot_deepseekv4_pro")
    expect(within(botCells[4]).getByRole("link", { name: "3.1 Pro Preview" })).toHaveAttribute("href", "/user/llm_gemini31_pro_preview")
    expect(within(botCells[4]).getByRole("link", { name: "5.2" })).toHaveAttribute("href", "/user/llm_glm52")
    expect(within(botCells[4]).getByRole("link", { name: "K2.7 Code" })).toHaveAttribute("href", "/user/llm_kimi_k27_code")
    expect(within(botCells[4]).getByRole("link", { name: "4 405B" })).toHaveAttribute("href", "/user/llm_hermes4_405b")
    expect(screen.getByRole("heading", { name: "Why subscriptions help" })).toBeInTheDocument()
    expect(screen.getByText(/The free T1 level covers almost everything most players need/i)).toBeInTheDocument()
    expect(screen.getByText(/bring more challenge, variety, and joy/i)).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Bot availability" })).toBeInTheDocument()
    expect(screen.getByText(/provider downtime, API limits, or temporary service issues/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "any@kriegspiel.org" })).toHaveAttribute(
      "href",
      "mailto:any@kriegspiel.org",
    )
    expect(screen.getByRole("link", { name: "X.com" })).toHaveAttribute("href", "https://x.com/kriegspiel")
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Public player profile" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Leaderboard eligibility" })).not.toBeInTheDocument()

    const chooseStrongButton = screen.getByRole("button", { name: "Choose Tier T3 Strong" })
    await waitFor(() => {
      expect(chooseStrongButton).toBeEnabled()
    })
    fireEvent.click(chooseStrongButton)
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

  it("uses_the_current_paid_tier_as_the_initial_selection", async () => {
    mockBillingApi.getSubscription.mockResolvedValueOnce(billingStatus({ current_tier: "tier4" }))

    renderPage()

    await screen.findByRole("heading", { name: "Subscription" })
    const controls = screen.getByRole("region", { name: "Subscription controls" })
    expect(await within(controls).findByRole("heading", { name: "Tier T4 Expert" })).toBeInTheDocument()
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
