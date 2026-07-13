export const BOT_TIER_ORDER = ["T0", "T1", "T2", "T3", "T4", "T5"]

const BOT_ACCESS_TIER_ORDER = ["guest", "tier1", "tier2", "tier3", "tier4", "tier5", "tier6"]

const BOT_ACCESS_TIER_BY_CODE = {
  T0: "guest",
  T1: "tier1",
  T2: "tier2",
  T3: "tier3",
  T4: "tier4",
  T5: "tier5",
  T6: "tier6",
}

const BOT_ACCESS_TIER_CODE = {
  guest: "T0",
  tier1: "T1",
  tier2: "T2",
  tier3: "T3",
  tier4: "T4",
  tier5: "T5",
  tier6: "T6",
}

export const BOT_TIER_LABELS = {
  T0: "Simple bots",
  T1: "Casual bots",
  T2: "Club bots",
  T3: "Strong bots",
  T4: "Expert bots",
  T5: "Master bots",
}

const SUBSCRIPTION_TIER_BY_BOT_TIER_CODE = {
  T2: "tier2",
  T3: "tier3",
  T4: "tier4",
}

const BOT_TIER_BY_USERNAME = {
  darkboardmcts: "T1",
  simpleheuristics: "T1",
  stockfishwild: "T1",
  llm_gpt45nano: "T2",
  llm_gptnano: "T2",
  llm_haiku: "T2",
  openrouter_gemini25_lite: "T2",
  openrouter_deepseekv4_flash: "T2",
  openrouter_gptoss120b: "T2",
  openrouter_gemini31_lite: "T3",
  openrouter_llama31_8b: "T2",
  llm_gemini25_lite: "T2",
  llm_deepseekv4_flash: "T2",
  llm_gptoss120b: "T2",
  llm_gemini31_lite: "T3",
  llm_llama31_8b: "T2",
  llm_llama4_scout: "T2",
  llm_llama4_maverick: "T2",
  llm_mistral_nemo: "T2",
  llm_mistral_small32: "T2",
  llm_gemma3_4b: "T2",
  llm_gemma3_27b: "T2",
  llm_gemma4_31b: "T2",
  llm_glm47_flash: "T2",
  llm_glm45_air: "T2",
  llm_nemotron_nano: "T2",
  llm_nemotron_super: "T2",
  llm_nemotron_ultra: "T3",
  llm_kimi_k25: "T2",
  llm_hermes4_70b: "T2",
  llm_phi4: "T2",
  llm_qwen_plus: "T2",
  llm_qwen37_plus: "T2",
  llm_deepseek_v32: "T2",
  llm_minimax_m3: "T2",
  openrouter_qwen36_flash: "T3",
  llm_qwen36_flash: "T3",
  llm_gpt56_luna: "T3",
  llm_sonnet5: "T3",
  llm_gemini25_flash: "T3",
  llm_gemini35_flash: "T3",
  llm_mistral_large3: "T3",
  llm_mistral_medium35: "T3",
  llm_kimi_k2_thinking: "T3",
  llm_hermes3_70b: "T3",
  openrouter_deepseekv4_pro: "T4",
  bot_deepseekv4_pro: "T4",
  llm_opus48: "T4",
  llm_gpt56_terra: "T4",
  llm_gemini31_pro_preview: "T4",
  llm_glm52: "T4",
  llm_kimi_k27_code: "T4",
  llm_hermes4_405b: "T4",
  llm_gpt55: "T5",
  llm_gpt56_sol: "T5",
  llm_grok45: "T5",
  llm_gpt55_pro: "T5",
  llm_qwen37_max: "T5",
}

const CATALOG_HIDDEN_BOT_USERNAMES = new Set([
  "llm_gemma3_4b",
  "llm_gemma3_27b",
  "llm_gemini25_flash",
  "llm_gemini25_lite",
  "llm_llama31_8b",
  "llm_llama4_scout",
  "llm_mistral_nemo",
  "openrouter_gemini25_lite",
  "openrouter_gemini31_lite",
  "openrouter_llama31_8b",
])

export function botRating(bot) {
  const elo = Number(bot?.elo)
  return Number.isFinite(elo) ? elo : 1200
}

export function isCatalogHiddenBot(bot) {
  return CATALOG_HIDDEN_BOT_USERNAMES.has(String(bot?.username || "").trim().toLowerCase())
}

export function botTierCode(bot) {
  const username = String(bot?.username || "").trim().toLowerCase()
  return BOT_TIER_BY_USERNAME[username] ?? "T0"
}

function botTierIndex(bot) {
  const index = BOT_TIER_ORDER.indexOf(botTierCode(bot))
  return index === -1 ? BOT_TIER_ORDER.length : index
}

function normalizeBotAccessTier(value) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[-_]/g, "") : ""
  if (normalized === "guest" || normalized === "none") return "guest"
  if (/^tier[1-6]$/.test(normalized)) return normalized
  if (/^[1-6]$/.test(normalized)) return `tier${normalized}`
  return ""
}

export function viewerBotAccessTier(user) {
  if (user?.is_guest === true || String(user?.role || "").trim().toLowerCase() === "guest") {
    return "guest"
  }

  return normalizeBotAccessTier(user?.llm_bot_tier)
    || normalizeBotAccessTier(user?.current_tier)
    || normalizeBotAccessTier(user?.billing?.tier)
    || "tier1"
}

function botRequiredAccessTier(bot) {
  return normalizeBotAccessTier(bot?.required_tier)
    || BOT_ACCESS_TIER_BY_CODE[botTierCode(bot)]
    || "guest"
}

function tierAllowsBot(viewerTier, requiredTier) {
  const viewerIndex = BOT_ACCESS_TIER_ORDER.indexOf(viewerTier)
  const requiredIndex = BOT_ACCESS_TIER_ORDER.indexOf(requiredTier)
  if (viewerIndex === -1 || requiredIndex === -1) {
    return false
  }
  return viewerIndex >= requiredIndex
}

export function botAvailableForViewer(bot, viewerTier) {
  if (typeof bot?.available_for_viewer === "boolean") {
    return bot.available_for_viewer
  }
  return tierAllowsBot(viewerTier, botRequiredAccessTier(bot))
}

export function botRequiredTierCode(bot) {
  return BOT_ACCESS_TIER_CODE[botRequiredAccessTier(bot)] ?? botTierCode(bot)
}

function subscriptionPathForBotTier(code) {
  const tier = SUBSCRIPTION_TIER_BY_BOT_TIER_CODE[code]
  return tier ? `/subscription?tier=${tier}` : "/subscription"
}

export function subscriptionPathForBot(bot) {
  return subscriptionPathForBotTier(botRequiredTierCode(bot))
}

export function botPickerName(bot) {
  return String(bot?.display_name ?? "Unknown bot").replace(/\s*\(bot\)\s*$/i, "").trim() || "Unknown bot"
}

export function botPickerLimitLabel(bot) {
  if (!bot?.llm_backed || typeof bot?.llm_bot_limit_label !== "string") {
    return ""
  }

  const limitLabel = bot.llm_bot_limit_label.trim()
  return /^no\s+ply\s+limit$/i.test(limitLabel) ? "" : limitLabel
}

export function formatBotPickerLabel(bot) {
  const limitLabel = botPickerLimitLabel(bot)
  return `${botRating(bot)} - ${botPickerName(bot)}${limitLabel ? ` (${limitLabel})` : ""}`
}

export function compareBotPickerBots(left, right) {
  const tierDelta = botTierIndex(left) - botTierIndex(right)
  if (tierDelta !== 0) {
    return tierDelta
  }

  const ratingDelta = botRating(left) - botRating(right)
  if (ratingDelta !== 0) {
    return ratingDelta
  }

  return String(left?.display_name ?? left?.username ?? "").localeCompare(String(right?.display_name ?? right?.username ?? ""))
}

export function groupBotsByTier(bots) {
  const groups = new Map(BOT_TIER_ORDER.map((code) => [code, []]))
  bots.forEach((bot) => {
    const code = botTierCode(bot)
    if (!groups.has(code)) {
      groups.set(code, [])
    }
    groups.get(code).push(bot)
  })

  return Array.from(groups.entries())
    .filter(([, tierBots]) => tierBots.length > 0)
    .map(([code, tierBots]) => ({ code, label: BOT_TIER_LABELS[code] ?? `${code} bots`, bots: tierBots }))
}
