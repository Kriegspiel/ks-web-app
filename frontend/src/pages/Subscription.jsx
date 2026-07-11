import { useEffect, useMemo, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { loadStripe } from "@stripe/stripe-js"
import TierBadge from "../components/TierBadge"
import VersionStamp from "../components/VersionStamp"
import { billingApi } from "../services/api"
import { useAuth } from "../hooks/useAuth"
import "./Subscription.css"

const TIERS = [
  { key: "tier0", apiTier: null, code: "T0", name: "Guest", price: "Free", selectable: false },
  { key: "tier1", apiTier: null, code: "T1", name: "Casual", price: "Free", selectable: false },
  { key: "tier2", apiTier: "tier2", code: "T2", name: "Club", price: "$10/mo / $100/yr", selectable: true },
  { key: "tier3", apiTier: "tier3", code: "T3", name: "Strong", price: "$20/mo / $200/yr", selectable: true },
  { key: "tier4", apiTier: "tier4", code: "T4", name: "Expert", price: "$50/mo / $500/yr", selectable: true },
  { key: "tier5", apiTier: null, code: "T5", name: "Master", price: "Not available yet", selectable: false, future: true },
  { key: "tier6", apiTier: null, code: "T6", name: "Elite", price: "Not available yet", selectable: false, future: true },
]

const T0_BOTS = [
  ["T0-level bots", [["Random Bot", "/user/randobot"], ["Random Any Bot", "/user/randobotany"], ["Darkboard MCTS", "/user/darkboardmcts"]]],
]

const T1_BOTS = [
  ["T1-level bots", [["Simple Heuristics Bot", "/user/simpleheuristics"], ["Stockfish Wild 16", "/user/stockfishwild"]]],
]

const T2_BOTS = [
  ["T2 OpenAI", [["GPTNano", "/user/llm_gptnano"], ["GPT-OSS", "/user/llm_gptoss120b"]]],
  ["T2 Anthropic", [["Claude Haiku 4.5", "/user/llm_haiku"]]],
  ["T2 DeepSeek", [["V4 Flash", "/user/llm_deepseekv4_flash"]]],
  ["T2 Gemini", [["2.5 Flash-Lite", "/user/llm_gemini25_lite"], ["3.1 Flash-Lite", "/user/llm_gemini31_lite"]]],
  ["T2 Llama", [["3.1 8B", "/user/llm_llama31_8b"], ["4 Scout", "/user/llm_llama4_scout"], ["4 Maverick", "/user/llm_llama4_maverick"]]],
  ["T2 Mistral", [["Nemo", "/user/llm_mistral_nemo"], ["Small 3.2", "/user/llm_mistral_small32"], ["Large 3", "/user/llm_mistral_large3"]]],
  ["T2 Gemma", [["3 4B", "/user/llm_gemma3_4b"], ["3 27B", "/user/llm_gemma3_27b"], ["4 31B", "/user/llm_gemma4_31b"]]],
  ["T2 GLM", [["4.7 Flash", "/user/llm_glm47_flash"], ["4.5 Air", "/user/llm_glm45_air"]]],
  ["T2 Nemotron", [["Nano", "/user/llm_nemotron_nano"], ["Super", "/user/llm_nemotron_super"], ["Ultra", "/user/llm_nemotron_ultra"]]],
  ["T2 Kimi", [["K2.5", "/user/llm_kimi_k25"]]],
  ["T2 Hermes", [["4 70B", "/user/llm_hermes4_70b"]]],
  ["T2 Phi", [["4", "/user/llm_phi4"]]],
]

const T3_BOTS = [
  ["T3 OpenAI", ["GPT-5.5"]],
  ["T3 Anthropic", ["Claude Sonnet 5"]],
  ["T3 Gemini", ["2.5 Flash"]],
  ["T3 Qwen", [["3.6 Flash", "/user/llm_qwen36_flash"], "Plus"]],
  ["T3 Kimi", ["K2 Thinking"]],
  ["T3 Hermes", ["3 70B"]],
]

const T4_BOTS = [
  ["T4 Anthropic", ["Claude Opus 4.8"]],
  ["T4 DeepSeek", [["V4 Pro", "/user/bot_deepseekv4_pro"]]],
  ["T4 Gemini", ["3.1 Pro Preview"]],
  ["T4 GLM", ["5.2"]],
  ["T4 Kimi", ["K2.7 Code"]],
  ["T4 Hermes", ["4 405B"]],
]

const T5_BOTS = [
  ["T5 OpenAI", ["GPT-5.5 Pro"]],
  ["T5 Qwen", ["3.7 Max"]],
]

const LOWER_TIER_BOTS_INCLUDED = { type: "note", text: "Lower-tier bots included." }

function withLowerTierBots(groups) {
  return [LOWER_TIER_BOTS_INCLUDED, ...groups]
}

const PLAY_BOTS_BY_TIER = [
  T0_BOTS,
  withLowerTierBots(T1_BOTS),
  withLowerTierBots(T2_BOTS),
  withLowerTierBots(T3_BOTS),
  withLowerTierBots(T4_BOTS),
  withLowerTierBots(T5_BOTS),
  withLowerTierBots([]),
]

const FEATURES = [
  { name: "Play human games", values: ["Yes", "Yes", "Yes", "Yes", "Yes", null, null] },
  { name: "Rating history", values: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"] },
  { name: "Play bots", values: PLAY_BOTS_BY_TIER },
  { name: "Completed-game review", values: ["Yes", "Yes", "Yes", "Yes", "Yes", null, null] },
  { name: "Persistent player name", values: ["No", "Yes", "Yes", "Yes", "Yes", null, null] },
]

function BotList({ groups }) {
  return (
    <div className="subscription-bot-list">
      {groups.map((group) => {
        if (group?.type === "note") {
          return <div key={group.text} className="subscription-bot-list__note">{group.text}</div>
        }
        const [label, items] = group
        return (
          <div key={label}>
            <strong>{label}:</strong>{" "}
            {items.map((item, index) => {
              const text = Array.isArray(item) ? item[0] : item
              const path = Array.isArray(item) ? item[1] : null
              return (
                <span key={`${label}-${text}`}>
                  {index > 0 ? "; " : ""}
                  {path ? <Link to={path}>{text}</Link> : text}
                </span>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function FeatureValue({ value }) {
  if (value === null) {
    return <span className="subscription-tier-table__future">Not available</span>
  }
  if (Array.isArray(value)) {
    return <BotList groups={value} />
  }
  const markClass = value === "Yes" ? "subscription-tier-table__mark--yes" : "subscription-tier-table__mark--no"
  return <span className={`subscription-tier-table__mark ${markClass}`}>{value}</span>
}

function isPlanAvailable(status, tier, interval) {
  if (!tier) return false
  return status?.available_prices?.[tier]?.[interval] === true
}

function firstAvailableInterval(status, tier) {
  return ["monthly", "yearly"].find((option) => isPlanAvailable(status, tier, option)) ?? null
}

function isTierAvailable(status, tier) {
  return firstAvailableInterval(status, tier) !== null
}

function firstAvailablePlan(status) {
  const currentTier = ["tier2", "tier3", "tier4"].includes(status?.current_tier) ? status.current_tier : null
  const preferredTiers = currentTier ? [currentTier, ...["tier2", "tier3", "tier4"].filter((tier) => tier !== currentTier)] : ["tier2", "tier3", "tier4"]
  for (const tier of preferredTiers) {
    const interval = firstAvailableInterval(status, tier)
    if (interval) return { tier, interval }
  }
  return { tier: "tier2", interval: "monthly" }
}

function tierByApiTier(apiTier) {
  return TIERS.find((tier) => tier.apiTier === apiTier) ?? TIERS[2]
}

function currentTierKey(status, user) {
  if (user?.is_guest === true) return "tier0"
  const tier = typeof status?.current_tier === "string" ? status.current_tier : status?.billing?.tier
  return TIERS.some((option) => option.key === tier) ? tier : "tier1"
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ")
}

function createEmbeddedCheckout(stripe, options) {
  if (typeof stripe?.createEmbeddedCheckoutPage === "function") {
    return stripe.createEmbeddedCheckoutPage(options)
  }
  if (typeof stripe?.initEmbeddedCheckout === "function") {
    return stripe.initEmbeddedCheckout(options)
  }
  throw new Error("Stripe embedded checkout is not available.")
}

export default function SubscriptionPage() {
  const { user } = useAuth()
  const [status, setStatus] = useState(null)
  const [selectedTier, setSelectedTier] = useState("tier2")
  const [interval, setInterval] = useState("monthly")
  const [loading, setLoading] = useState(true)
  const [billingError, setBillingError] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutMounted, setCheckoutMounted] = useState(false)
  const checkoutContainerRef = useRef(null)
  const embeddedCheckoutRef = useRef(null)

  useEffect(() => {
    let active = true
    async function loadBilling() {
      setLoading(true)
      setBillingError("")
      try {
        const payload = await billingApi.getSubscription()
        if (!active) return
        const firstPlan = firstAvailablePlan(payload)
        setStatus(payload)
        setSelectedTier(firstPlan.tier)
        setInterval(firstPlan.interval)
      } catch (error) {
        if (active) setBillingError(error?.message ?? "Unable to load billing details right now.")
      } finally {
        if (active) setLoading(false)
      }
    }
    loadBilling()
    return () => {
      active = false
      embeddedCheckoutRef.current?.destroy?.()
      embeddedCheckoutRef.current = null
    }
  }, [])

  const stripePromise = useMemo(() => {
    if (!status?.publishable_key) return null
    return loadStripe(status.publishable_key)
  }, [status?.publishable_key])

  const selectedTierDetails = tierByApiTier(selectedTier)
  const selectedAvailable = isPlanAvailable(status, selectedTier, interval)
  const activeSubscription = ["active", "trialing"].includes(status?.billing?.subscription_status)
  const canSubscribe = status?.enabled === true && selectedAvailable && user?.is_guest !== true && !activeSubscription
  const currentTier = currentTierKey(status, user)

  function clearCheckoutForm() {
    embeddedCheckoutRef.current?.destroy?.()
    embeddedCheckoutRef.current = null
    setCheckoutMounted(false)
  }

  function chooseTier(tier) {
    clearCheckoutForm()
    setSelectedTier(tier)
    if (!isPlanAvailable(status, tier, interval)) {
      const nextInterval = firstAvailableInterval(status, tier)
      if (nextInterval) setInterval(nextInterval)
    }
  }

  function chooseInterval(nextInterval) {
    clearCheckoutForm()
    setInterval(nextInterval)
  }

  async function startCheckout() {
    if (!canSubscribe || !stripePromise || !checkoutContainerRef.current) return
    setCheckoutLoading(true)
    setBillingError("")
    clearCheckoutForm()
    try {
      const stripe = await stripePromise
      if (!stripe) throw new Error("Stripe is not ready.")
      const checkout = await createEmbeddedCheckout(stripe, {
        fetchClientSecret: async () => {
          const response = await billingApi.createCheckoutSession({ tier: selectedTier, interval })
          return response.client_secret
        },
      })
      embeddedCheckoutRef.current = checkout
      checkout.mount(checkoutContainerRef.current)
      setCheckoutMounted(true)
    } catch (error) {
      setBillingError(error?.message ?? "Unable to start checkout right now.")
    } finally {
      setCheckoutLoading(false)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    setBillingError("")
    try {
      const response = await billingApi.createPortalSession()
      window.location.assign(response.url)
    } catch (error) {
      setBillingError(error?.message ?? "Unable to open billing management right now.")
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <main className="page-shell subscription-page">
      <header className="subscription-page__header">
        <div>
          <h1>Subscription</h1>
          <p>Choose your Kriegspiel level and manage billing for this account.</p>
        </div>
        <button
          type="button"
          className="button-link--secondary subscription-manage-billing-button"
          onClick={openPortal}
          disabled={portalLoading || user?.is_guest === true}
          aria-label={portalLoading ? "Opening billing management" : "Manage billing (opens external website)"}
        >
          {portalLoading ? "Opening..." : (
            <>
              <span>Manage billing</span>
              <span aria-hidden="true" className="subscription-manage-billing-button__external">↗</span>
            </>
          )}
        </button>
      </header>

      {loading ? <p>Loading subscription...</p> : null}
      {billingError ? <p className="auth-error" role="alert">{billingError}</p> : null}

      {user?.is_guest === true ? (
        <section className="subscription-notice" aria-label="Guest subscription notice">
          <p>
            Guest accounts need to become regular accounts before subscribing. Convert this guest from your{" "}
            <Link to={`/user/${encodeURIComponent(user.username)}`}>profile</Link>.
          </p>
        </section>
      ) : null}

      <section className="subscription-controls" aria-label="Subscription controls">
        <div className="subscription-controls__plan">
          <TierBadge code={selectedTierDetails.code} />
          <div>
            <h2>Tier {selectedTierDetails.code} {selectedTierDetails.name}</h2>
            <p>{selectedTierDetails.price}</p>
          </div>
        </div>
        <div className="subscription-interval-toggle" aria-label="Billing interval">
          {["monthly", "yearly"].map((option) => (
            <button
              key={option}
              type="button"
              className={interval === option ? "is-active" : ""}
              onClick={() => chooseInterval(option)}
              disabled={!isPlanAvailable(status, selectedTier, option)}
            >
              {option === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        <button type="button" onClick={startCheckout} disabled={!canSubscribe || checkoutLoading}>
          {activeSubscription
            ? "Use billing management"
            : checkoutLoading
              ? "Opening payment form..."
              : checkoutMounted ? "Refresh payment form" : "Open payment form"}
        </button>
      </section>

      {status?.enabled === false ? (
        <section className="subscription-notice" aria-label="Billing unavailable">
          <p>Payments are not available yet.</p>
        </section>
      ) : null}

      <div ref={checkoutContainerRef} className="subscription-checkout" aria-label="Stripe payment form" />

      <section className="subscription-table-section" aria-label="Feature availability by tier">
        <div className="subscription-tier-table-wrap">
          <table className="subscription-tier-table">
            <colgroup>
              <col className="subscription-tier-table__feature-col" />
              {TIERS.map((tier) => <col key={tier.key} className="subscription-tier-table__tier-col" />)}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                {TIERS.map((tier) => {
                  const available = tier.selectable && isTierAvailable(status, tier.apiTier)
                  const selected = tier.apiTier === selectedTier
                  const current = tier.key === currentTier
                  return (
                    <th
                      key={tier.key}
                      scope="col"
                      aria-current={current ? "true" : undefined}
                      className={classNames(
                        tier.future && "subscription-tier-table__unavailable-column",
                        current && "subscription-tier-table__current-column",
                      )}
                    >
                      <span className="subscription-tier-table__heading">
                        <span className="subscription-tier-table__tier-label">
                          <span>Tier</span>
                          <TierBadge code={tier.code} />
                        </span>
                        <span className="subscription-tier-table__name">{tier.name}</span>
                        {current ? <span className="subscription-tier-table__current-label">Current tier</span> : null}
                        <span className="subscription-tier-table__price">{tier.price}</span>
                        {tier.selectable ? (
                          <button
                            type="button"
                            className={selected ? "is-selected" : ""}
                            onClick={() => chooseTier(tier.apiTier)}
                            disabled={!available}
                            aria-label={`Choose Tier ${tier.code} ${tier.name}`}
                          >
                            {selected ? "Selected" : "Choose"}
                          </button>
                        ) : null}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((feature) => (
                <tr key={feature.name}>
                  <th scope="row">{feature.name}</th>
                  {feature.values.map((value, index) => (
                    <td
                      key={`${feature.name}-${TIERS[index].key}`}
                      className={classNames(
                        TIERS[index].future && "subscription-tier-table__unavailable-column",
                        TIERS[index].key === currentTier && "subscription-tier-table__current-column",
                      )}
                    >
                      <FeatureValue value={value} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <VersionStamp />
    </main>
  )
}
