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
    expect(screen.getByRole("rowheader", { name: "Play T2 bots" })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: "GPTNano" })[0]).toHaveAttribute("href", "/user/llm_gptnano")
    expect(screen.getByText(TEST_VERSION_STAMP)).toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Public player profile" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Leaderboard eligibility" })).not.toBeInTheDocument()
    expect(screen.queryByRole("rowheader", { name: "Rating history" })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Choose Tier T3 Strong" }))
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
