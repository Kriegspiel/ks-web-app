import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import SubscriptionPage from "../pages/Subscription"
import { TEST_VERSION_STAMP } from "../version"

const mockAuth = vi.hoisted(() => ({
  user: { username: "playerone", is_guest: false },
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
  it("renders_the_tier_table_and_mounts_embedded_checkout_for_the_selected_plan", async () => {
    renderPage()

    await screen.findByRole("heading", { name: "Subscription" })
    expect(screen.getByRole("button", { name: "Manage billing (opens external website)" })).toHaveTextContent(/Manage billing\s*↗/)
    const currentTierHeader = screen.getByText("Current tier").closest("th")
    expect(currentTierHeader).toHaveAttribute("aria-current", "true")
    expect(currentTierHeader).toHaveTextContent("Casual")
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
    expect(within(botCells[2]).queryByRole("link", { name: "Ultra" })).not.toBeInTheDocument()
    expect(within(botCells[2]).queryByRole("link", { name: "Simple Heuristics Bot" })).not.toBeInTheDocument()
    expect(within(botCells[3]).getByText("Lower-tier bots included.")).toBeInTheDocument()
    expect(within(botCells[3]).getByRole("link", { name: "Ultra" })).toHaveAttribute("href", "/user/llm_nemotron_ultra")
    expect(screen.getByRole("heading", { name: "Why subscriptions help" })).toBeInTheDocument()
    expect(screen.getByText(/The free T1 level covers almost everything most players need/i)).toBeInTheDocument()
    expect(screen.getByText(/stronger bots use paid AI tokens/i)).toBeInTheDocument()
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Public player profile" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Leaderboard eligibility" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Choose Tier T3 Strong" }))
    expect(screen.getByText("Current tier").closest("th")).toHaveTextContent("Casual")
    fireEvent.click(screen.getByRole("button", { name: "Yearly" }))
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
    expect(screen.getByRole("region", { name: "Guest subscription notice" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "profile" })).toHaveAttribute("href", "/user/guest_adolf_adams")
    expect(screen.getByRole("button", { name: "Open payment form" })).toBeDisabled()
  })
})
