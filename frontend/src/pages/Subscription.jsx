import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { loadStripe } from "@stripe/stripe-js"
import {
  botPickerName,
  botTierCode,
  compareBotPickerBots,
  isCatalogHiddenBot,
} from "../botCatalog"
import TierBadge from "../components/TierBadge"
import VersionStamp from "../components/VersionStamp"
import { billingApi, getBots } from "../services/api"
import { useAuth } from "../hooks/useAuth"
import "./Subscription.css"

const TIERS = [
  { key: "tier0", apiTier: null, code: "T0", name: "Guest", price: "Free", selectable: false },
  { key: "tier1", apiTier: null, code: "T1", name: "Casual", price: "Free", selectable: false },
  { key: "tier2", apiTier: "tier2", code: "T2", name: "Club", price: { monthly: "$10/mo", yearly: "$100/yr" }, selectable: true },
  { key: "tier3", apiTier: "tier3", code: "T3", name: "Strong", price: { monthly: "$20/mo", yearly: "$200/yr" }, selectable: true },
  { key: "tier4", apiTier: "tier4", code: "T4", name: "Expert", price: { monthly: "$50/mo", yearly: "$500/yr" }, selectable: true },
  { key: "tier5", apiTier: "tier5", code: "T5", name: "Master", price: "Not available yet", selectable: false, future: true },
  { key: "tier6", apiTier: null, code: "T6", name: "Elite", price: "Not available yet", selectable: false, future: true },
]
const SUBSCRIPTION_BOT_TIER_ORDER = TIERS.map((tier) => tier.code)
const REQUESTED_TIER_KEYS = new Set(TIERS.map((tier) => tier.apiTier).filter(Boolean))

const REASONING_MEDIUM = "medium"

function subscriptionBot(username, model, reasoning = "") {
  return { username, model, path: `/user/${username}`, reasoning }
}

const T0_BOTS = [
  ["Kriegspiel", [subscriptionBot("randobot", "Random Bot"), subscriptionBot("randobotany", "Random Any")]],
]

const T1_BOTS = [
  [
    "Kriegspiel",
    [
      subscriptionBot("darkboardmcts", "Darkboard MCTS"),
      subscriptionBot("simpleheuristics", "Simple Heuristics Bot"),
      subscriptionBot("stockfishwild", "Stockfish Wild 16"),
    ],
  ],
]

const T2_BOTS = [
  ["OpenAI", [subscriptionBot("llm_gptnano", "GPT Nano"), subscriptionBot("llm_gptoss120b", "GPT-OSS 120B")]],
  ["Anthropic", [subscriptionBot("llm_haiku", "Claude Haiku")]],
  ["DeepSeek", [subscriptionBot("llm_deepseekv4_flash", "DeepSeek V4 Flash"), subscriptionBot("llm_deepseek_v32", "DeepSeek V3.2")]],
  ["Meta", [subscriptionBot("llm_llama4_maverick", "Llama 4 Maverick")]],
  ["Mistral AI", [subscriptionBot("llm_mistral_small32", "Mistral Small 3.2")]],
  ["Google", [subscriptionBot("llm_gemma4_31b", "Gemma 4 31B")]],
  ["Z.AI", [subscriptionBot("llm_glm47_flash", "GLM 4.7 Flash"), subscriptionBot("llm_glm45_air", "GLM 4.5 Air")]],
  ["Nvidia", [subscriptionBot("llm_nemotron_super", "Nemotron Super")]],
  ["Alibaba", [subscriptionBot("llm_qwen_plus", "Qwen Plus"), subscriptionBot("llm_qwen37_plus", "Qwen 3.7 Plus")]],
  ["MiniMax", [subscriptionBot("llm_minimax_m3", "MiniMax M3")]],
  ["Moonshot AI", [subscriptionBot("llm_kimi_k25", "Kimi K2.5")]],
  ["Nous Research", [subscriptionBot("llm_hermes4_70b", "Hermes 4 70B")]],
  ["Microsoft", [subscriptionBot("llm_phi4", "Phi 4")]],
]

const T3_BOTS = [
  ["OpenAI", [subscriptionBot("llm_gpt56_luna", "GPT-5.6 Luna")]],
  ["Anthropic", [subscriptionBot("llm_sonnet5", "Claude Sonnet 5")]],
  ["Google", [subscriptionBot("llm_gemini31_lite", "Gemini 3.1 Flash-Lite"), subscriptionBot("llm_gemini35_flash", "Gemini 3.5 Flash")]],
  ["Mistral AI", [subscriptionBot("llm_mistral_large3", "Mistral Large 3"), subscriptionBot("llm_mistral_medium35", "Mistral Medium 3.5")]],
  ["Nvidia", [subscriptionBot("llm_nemotron_ultra", "Nemotron Ultra")]],
  ["Alibaba", [subscriptionBot("llm_qwen36_flash", "Qwen 3.6 Flash")]],
  ["Moonshot AI", [subscriptionBot("llm_kimi_k2_thinking", "Kimi K2 Thinking")]],
  ["Nous Research", [subscriptionBot("llm_hermes3_70b", "Hermes 3 70B")]],
]

const T4_BOTS = [
  ["Anthropic", [subscriptionBot("llm_opus48", "Claude Opus 4.8")]],
  ["OpenAI", [subscriptionBot("llm_gpt56_terra", "GPT-5.6 Terra")]],
  ["DeepSeek", [subscriptionBot("bot_deepseekv4_pro", "DeepSeek V4 Pro")]],
  ["Google", [subscriptionBot("llm_gemini31_pro_preview", "Gemini 3.1 Pro Preview")]],
  ["Z.AI", [subscriptionBot("llm_glm52", "GLM 5.2")]],
  ["Moonshot AI", [subscriptionBot("llm_kimi_k27_code", "Kimi K2.7 Code")]],
  ["Nous Research", [subscriptionBot("llm_hermes4_405b", "Hermes 4 405B")]],
]

const T5_BOTS = [
  [
    "OpenAI",
    [
      subscriptionBot("llm_gpt56_sol", "GPT-5.6 Sol"),
      subscriptionBot("llm_gpt55", "GPT-5.5"),
      subscriptionBot("llm_gpt55_pro", "GPT-5.5 Pro", REASONING_MEDIUM),
    ],
  ],
  ["xAI", [subscriptionBot("llm_grok45", "Grok 4.5")]],
  ["Alibaba", [subscriptionBot("llm_qwen37_max", "Qwen 3.7 Max")]],
]

const SUBSCRIPTION_BOT_CATALOG_GROUPS = [T0_BOTS, T1_BOTS, T2_BOTS, T3_BOTS, T4_BOTS, T5_BOTS]
const SUBSCRIPTION_BOT_DISPLAY_BY_USERNAME = new Map()
let subscriptionBotCatalogOrder = 0
SUBSCRIPTION_BOT_CATALOG_GROUPS.forEach((tierGroups) => {
  tierGroups.forEach(([provider, items]) => {
    items.forEach((item) => {
      SUBSCRIPTION_BOT_DISPLAY_BY_USERNAME.set(item.username, {
        ...item,
        provider,
        order: subscriptionBotCatalogOrder,
      })
      subscriptionBotCatalogOrder += 1
    })
  })
})

const LOWER_TIER_BOTS_INCLUDED = { type: "note", text: "Lower-tier bots included." }

function withLowerTierBots(groups) {
  return [LOWER_TIER_BOTS_INCLUDED, ...groups]
}

const STATIC_PLAY_BOTS_BY_TIER = [
  T0_BOTS,
  withLowerTierBots(T1_BOTS),
  withLowerTierBots(T2_BOTS),
  withLowerTierBots(T3_BOTS),
  withLowerTierBots(T4_BOTS),
  withLowerTierBots(T5_BOTS),
  withLowerTierBots([]),
]

const STATIC_FEATURES = [
  { name: "Play human games", values: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"] },
  { name: "Completed-game review", values: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"] },
  { name: "Rating history", values: ["Yes", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"] },
  { name: "Play bots", values: STATIC_PLAY_BOTS_BY_TIER },
  {
    name: "Custom LLM providers and strategies",
    values: [
      "No",
      "No",
      "No",
      "No",
      "No",
      "New LLM providers by request.",
      "New LLMs by request and fully customizable strategies and prompts.",
    ],
  },
  { name: "Persistent player name", values: ["No", "Yes", "Yes", "Yes", "Yes", "Yes", "Yes"] },
]

function profilePathForBot(bot) {
  const username = String(bot?.username || "").trim()
  return username ? `/user/${encodeURIComponent(username)}` : null
}

function normalizedBotUsername(bot) {
  return String(bot?.username || "").trim().toLowerCase()
}

function knownSubscriptionBot(bot) {
  return SUBSCRIPTION_BOT_DISPLAY_BY_USERNAME.get(normalizedBotUsername(bot)) ?? null
}

function visibleReasoningLevel(value) {
  const reasoning = String(value || "").trim().toLowerCase()
  return reasoning && reasoning !== "none" && reasoning !== "no" ? reasoning : ""
}

function subscriptionBotReasoning(bot) {
  const known = knownSubscriptionBot(bot)
  return visibleReasoningLevel(
    known?.reasoning
      || bot?.llm_reasoning_level
      || bot?.llm_reasoning_effort
      || bot?.reasoning_level
      || bot?.reasoning_effort
      || bot?.default_reasoning_level,
  )
}

function inferSubscriptionProvider(bot) {
  const known = knownSubscriptionBot(bot)
  if (known) return known.provider

  const haystack = `${normalizedBotUsername(bot)} ${botPickerName(bot)}`.toLowerCase()
  if (/gpt|openai/.test(haystack)) return "OpenAI"
  if (/claude|haiku|sonnet|opus|anthropic/.test(haystack)) return "Anthropic"
  if (/gemini|gemma|google/.test(haystack)) return "Google"
  if (/llama|meta/.test(haystack)) return "Meta"
  if (/mistral/.test(haystack)) return "Mistral AI"
  if (/deepseek/.test(haystack)) return "DeepSeek"
  if (/glm|z-ai|zai/.test(haystack)) return "Z.AI"
  if (/nemotron|nvidia/.test(haystack)) return "Nvidia"
  if (/qwen|alibaba/.test(haystack)) return "Alibaba"
  if (/minimax/.test(haystack)) return "MiniMax"
  if (/kimi|moonshot/.test(haystack)) return "Moonshot AI"
  if (/hermes|nous/.test(haystack)) return "Nous Research"
  if (/phi|microsoft/.test(haystack)) return "Microsoft"
  if (/grok|xai|x-ai/.test(haystack)) return "xAI"
  return bot?.llm_backed ? "Other LLM" : "Kriegspiel"
}

function inferSubscriptionModelName(bot) {
  const known = knownSubscriptionBot(bot)
  if (known) return known.model

  const cleanName = botPickerName(bot)
    .replace(/^(?:LLM|OpenRouter|OR)\s+/i, "")
    .replace(/\s+Bot$/i, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleanName || normalizedBotUsername(bot) || "Unknown bot"
}

function liveSubscriptionBotItem(bot) {
  const known = knownSubscriptionBot(bot)
  return {
    username: normalizedBotUsername(bot),
    model: inferSubscriptionModelName(bot),
    path: profilePathForBot(bot),
    provider: inferSubscriptionProvider(bot),
    reasoning: subscriptionBotReasoning(bot),
    order: known?.order ?? Number.POSITIVE_INFINITY,
  }
}

function compareSubscriptionBots(left, right) {
  const leftOrder = knownSubscriptionBot(left)?.order ?? Number.POSITIVE_INFINITY
  const rightOrder = knownSubscriptionBot(right)?.order ?? Number.POSITIVE_INFINITY
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }
  return compareBotPickerBots(left, right)
}

function subscriptionBotDisplayText(item) {
  const reasoning = visibleReasoningLevel(item?.reasoning)
  return reasoning ? `${item.model} (reasoning: ${reasoning})` : item.model
}

function livePlayBotsByTier(bots) {
  const groupsByTier = new Map(SUBSCRIPTION_BOT_TIER_ORDER.map((code) => [code, new Map()]))
  bots
    .filter((bot) => !isCatalogHiddenBot(bot))
    .sort(compareSubscriptionBots)
    .forEach((bot) => {
      const code = botTierCode(bot)
      const providerGroups = groupsByTier.get(code)
      if (!providerGroups) return
      const item = liveSubscriptionBotItem(bot)
      const providerItems = providerGroups.get(item.provider) ?? []
      providerItems.push(item)
      providerGroups.set(item.provider, providerItems)
    })

  return SUBSCRIPTION_BOT_TIER_ORDER.map((code, index) => {
    const providerGroups = groupsByTier.get(code) ?? new Map()
    const groups = Array.from(providerGroups.entries())
    return index === 0 ? groups : withLowerTierBots(groups)
  })
}

function featuresWithBotList(playBotsByTier) {
  return STATIC_FEATURES.map((feature) => (
    feature.name === "Play bots" ? { ...feature, values: playBotsByTier } : feature
  ))
}

function BotList({ groups }) {
  return (
    <div className="subscription-bot-list">
      {groups.map((group) => {
        if (group?.type === "note") {
          return <div key={group.text} className="subscription-bot-list__note">{group.text}</div>
        }
        const [label, items] = group
        return (
          <div key={label} className="subscription-bot-list__group">
            <strong className="subscription-bot-list__label">{label}:</strong>
            <ul className="subscription-bot-list__items">
              {items.map((item) => {
                const model = typeof item === "string" ? item : item.model
                const path = typeof item === "string" ? null : item.path
                const displayText = subscriptionBotDisplayText({ model, reasoning: item?.reasoning })
                return (
                  <li key={`${label}-${path || model}`}>
                    {path ? <Link to={path}>{displayText}</Link> : displayText}
                  </li>
                )
              })}
            </ul>
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
  if (value !== "Yes" && value !== "No") {
    return <span className="subscription-tier-table__text">{value}</span>
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

function normalizeDesiredTier(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[-_\s]/g, "") : ""
  const tier = /^t[2-6]$/.test(normalized) ? `tier${normalized.slice(1)}` : normalized
  return REQUESTED_TIER_KEYS.has(tier) ? tier : ""
}

function initialPlan(status, desiredTier) {
  if (desiredTier) {
    return { tier: desiredTier, interval: firstAvailableInterval(status, desiredTier) ?? "monthly" }
  }
  return firstAvailablePlan(status)
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

function TierPrice({ price, className = "" }) {
  if (typeof price === "string") {
    return <span className={className}>{price}</span>
  }
  return (
    <span className={classNames(className, "subscription-tier-price--stacked")}>
      <span>{price.monthly}</span>
      <span>{price.yearly}</span>
    </span>
  )
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

function scrollPageToTop() {
  const scrollRoot = document.scrollingElement ?? document.documentElement ?? document.body
  if (scrollRoot) {
    scrollRoot.scrollLeft = 0
    scrollRoot.scrollTop = 0
  }
  document.documentElement.scrollLeft = 0
  document.documentElement.scrollTop = 0
  document.body.scrollLeft = 0
  document.body.scrollTop = 0

  if (typeof window.scrollTo !== "function") return
  try {
    window.scrollTo({ left: 0, top: 0, behavior: "auto" })
  } catch {
    window.scrollTo(0, 0)
  }
}

export default function SubscriptionPage() {
  const { user, isAuthenticated, bootstrapping } = useAuth()
  const [searchParams] = useSearchParams()
  const desiredTier = normalizeDesiredTier(searchParams.get("tier") ?? searchParams.get("desiredTier") ?? searchParams.get("desired_tier"))
  const [status, setStatus] = useState(null)
  const [selectedTier, setSelectedTier] = useState("tier2")
  const [interval, setInterval] = useState("monthly")
  const [loading, setLoading] = useState(true)
  const [billingError, setBillingError] = useState("")
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [checkoutMounted, setCheckoutMounted] = useState(false)
  const [liveBots, setLiveBots] = useState(null)
  const checkoutContainerRef = useRef(null)
  const embeddedCheckoutRef = useRef(null)
  const hasSignedInUser = isAuthenticated && user !== null

  useLayoutEffect(() => {
    scrollPageToTop()
  }, [desiredTier])

  useEffect(() => {
    let active = true

    if (bootstrapping || !hasSignedInUser) {
      setLiveBots(null)
      return () => {
        active = false
      }
    }

    async function loadLiveBots() {
      try {
        const response = await getBots()
        if (active) setLiveBots(Array.isArray(response?.bots) ? response.bots : [])
      } catch {
        if (active) setLiveBots(null)
      }
    }

    loadLiveBots()
    return () => {
      active = false
    }
  }, [bootstrapping, hasSignedInUser])

  const playBotsByTier = useMemo(
    () => liveBots === null ? STATIC_PLAY_BOTS_BY_TIER : livePlayBotsByTier(liveBots),
    [liveBots],
  )
  const features = useMemo(() => featuresWithBotList(playBotsByTier), [playBotsByTier])

  useEffect(() => {
    let active = true

    if (bootstrapping) {
      return () => {
        active = false
      }
    }

    if (!hasSignedInUser) {
      setLoading(false)
      setBillingError("")
      setStatus(null)
      setSelectedTier(desiredTier || "tier2")
      setInterval("monthly")
      embeddedCheckoutRef.current?.destroy?.()
      embeddedCheckoutRef.current = null
      setCheckoutMounted(false)
      return () => {
        active = false
      }
    }

    async function loadBilling() {
      setLoading(true)
      setBillingError("")
      try {
        const payload = await billingApi.getSubscription()
        if (!active) return
        const firstPlan = initialPlan(payload, desiredTier)
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
  }, [bootstrapping, desiredTier, hasSignedInUser])

  const stripePromise = useMemo(() => {
    if (!status?.publishable_key) return null
    return loadStripe(status.publishable_key)
  }, [status?.publishable_key])

  const selectedTierDetails = tierByApiTier(selectedTier)
  const selectedAvailable = isPlanAvailable(status, selectedTier, interval)
  const activeSubscription = ["active", "trialing"].includes(status?.billing?.subscription_status)
  const canSubscribe = hasSignedInUser && status?.enabled === true && selectedAvailable && user?.is_guest !== true && !activeSubscription
  const currentTier = hasSignedInUser ? currentTierKey(status, user) : null

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
          <p>
            {hasSignedInUser
              ? "Choose your Kriegspiel level and manage billing for this account."
              : "Start free, play the core game, and graduate to stronger bot tiers whenever you want more challenge."}
          </p>
        </div>
        {hasSignedInUser ? (
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
        ) : null}
      </header>

      {(bootstrapping || loading) ? <p>Loading subscription...</p> : null}
      {hasSignedInUser && billingError ? <p className="auth-error" role="alert">{billingError}</p> : null}

      {!bootstrapping && !hasSignedInUser ? (
        <section className="subscription-public-invite" aria-label="Start free">
          <div>
            <h2>Create a profile and start playing.</h2>
            <p>
              The free Casual level already includes human games,
              completed-game review, rating history, and simple bots. Paid
              tiers are optional upgrades for stronger bots and project
              support.
            </p>
          </div>
          <div className="subscription-public-invite__actions">
            <Link className="button-link button-link--primary" to="/auth/register">Create free profile</Link>
            <Link className="button-link button-link--secondary" to="/">Start playing</Link>
          </div>
        </section>
      ) : null}

      {user?.is_guest === true ? (
        <section className="subscription-notice subscription-notice--warning" aria-label="Guest subscription notice">
          <p>
            Guest accounts need to become regular accounts before subscribing. Convert this guest from your{" "}
            <Link to={`/user/${encodeURIComponent(user.username)}`}>profile</Link>.
          </p>
        </section>
      ) : null}

      {hasSignedInUser ? (
        <section className="subscription-controls" aria-label="Subscription controls">
          <div className="subscription-controls__plan">
            <TierBadge code={selectedTierDetails.code} />
            <div>
              <h2>Tier {selectedTierDetails.code} {selectedTierDetails.name}</h2>
              <p><TierPrice price={selectedTierDetails.price} className="subscription-controls__price" /></p>
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
          <button
            type="button"
            className="subscription-payment-button"
            onClick={startCheckout}
            disabled={!canSubscribe || checkoutLoading}
          >
            {activeSubscription
              ? "Use billing management"
              : checkoutLoading
                ? "Opening payment form..."
                : checkoutMounted ? "Refresh payment form" : "Open payment form"}
          </button>
        </section>
      ) : null}

      {hasSignedInUser && status?.enabled === false ? (
        <section className="subscription-notice" aria-label="Billing unavailable">
          <p>Payments are not available yet.</p>
        </section>
      ) : null}

      {hasSignedInUser ? (
        <div ref={checkoutContainerRef} className="subscription-checkout" aria-label="Stripe payment form" />
      ) : null}

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
                        selected && "subscription-tier-table__selected-column",
                      )}
                    >
                      <span className="subscription-tier-table__heading">
                        <span className="subscription-tier-table__tier-label">
                          <span>Tier</span>
                          <TierBadge code={tier.code} />
                        </span>
                        <span className="subscription-tier-table__name">{tier.name}</span>
                        <TierPrice price={tier.price} className="subscription-tier-table__price" />
                        {current ? <span className="subscription-tier-table__current-label">Current level</span> : null}
                        {hasSignedInUser && tier.selectable ? (
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
              {features.map((feature) => (
                <tr key={feature.name}>
                  <th scope="row">{feature.name}</th>
                  {feature.values.map((value, index) => (
                    <td
                      key={`${feature.name}-${TIERS[index].key}`}
                      className={classNames(
                        TIERS[index].future && "subscription-tier-table__unavailable-column",
                        TIERS[index].key === currentTier && "subscription-tier-table__current-column",
                        TIERS[index].apiTier === selectedTier && "subscription-tier-table__selected-column",
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

      <section className="subscription-support-note" aria-labelledby="subscription-support-heading">
        <h2 id="subscription-support-heading">Why subscriptions help</h2>
        <p>
          Kriegspiel.org is built so everyone can enjoy the full experience and
          pleasure of the game without needing a paid plan. The free T1 level
          covers almost everything most players need to play, review, and keep
          improving.
        </p>
        <p>
          Paid tiers exist because stronger bots use paid AI tokens, and they
          bring more challenge, variety, and joy to the game. A subscription
          helps cover those costs while supporting the project and keeping
          Kriegspiel welcoming for everyone.
        </p>
      </section>

      <section className="subscription-availability-note" aria-labelledby="subscription-availability-heading">
        <h2 id="subscription-availability-heading">Bot availability</h2>
        <p>
          Bots depend on outside APIs and model providers, so individual bots
          may occasionally be unavailable because of provider downtime, API
          limits, or temporary service issues. We watch for those problems and
          try to bring affected bots back as quickly as possible.
        </p>
        <p>
          If something looks inconsistent, broken, or unexpectedly unavailable,
          please tell us right away at{" "}
          <a href="mailto:any@kriegspiel.org">any@kriegspiel.org</a> or on{" "}
          <a href="https://x.com/kriegspiel_org" target="_blank" rel="noreferrer">
            X.com (@kriegspiel_org)
          </a>
          .
        </p>
      </section>

      <VersionStamp />
    </main>
  )
}
