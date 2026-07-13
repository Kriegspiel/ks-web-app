import { describe, expect, it } from "vitest"
import {
  botAvailableForViewer,
  botPickerLimitLabel,
  botPickerName,
  botRating,
  botRequiredTierCode,
  botTierCode,
  compareBotPickerBots,
  formatBotPickerLabel,
  groupBotsByTier,
  isCatalogHiddenBot,
  subscriptionPathForBot,
  subscriptionPathForTierCode,
  viewerBotAccessTier,
} from "../botCatalog"

describe("botCatalog", () => {
  it("normalizes_bot_tiers_and_viewer_access", () => {
    expect(botTierCode({ username: " LLM_GPT55 " })).toBe("T5")
    expect(botTierCode({ username: "mystery_bot" })).toBe("T0")
    expect(botTierCode(null)).toBe("T0")
    expect(isCatalogHiddenBot({ username: " llm_mistral_nemo " })).toBe(true)
    expect(isCatalogHiddenBot({ username: "randobot" })).toBe(false)
    expect(isCatalogHiddenBot(null)).toBe(false)

    expect(viewerBotAccessTier({ is_guest: true, llm_bot_tier: "tier5" })).toBe("guest")
    expect(viewerBotAccessTier({ role: " Guest " })).toBe("guest")
    expect(viewerBotAccessTier({ llm_bot_tier: "none" })).toBe("guest")
    expect(viewerBotAccessTier({ llm_bot_tier: "Tier-3" })).toBe("tier3")
    expect(viewerBotAccessTier({ current_tier: "4" })).toBe("tier4")
    expect(viewerBotAccessTier({ billing: { tier: "tier_5" } })).toBe("tier5")
    expect(viewerBotAccessTier({ llm_bot_tier: "unknown" })).toBe("tier1")
  })

  it("checks_tier_availability_and_subscription_targets", () => {
    expect(botAvailableForViewer({ available_for_viewer: true, username: "llm_gpt55" }, "guest")).toBe(true)
    expect(botAvailableForViewer({ available_for_viewer: false, username: "randobot" }, "tier6")).toBe(false)
    expect(botAvailableForViewer({ username: "llm_gpt55" }, "tier4")).toBe(false)
    expect(botAvailableForViewer({ username: "llm_gpt55" }, "tier5")).toBe(true)
    expect(botAvailableForViewer({ username: "randobot" }, "")).toBe(false)

    expect(botRequiredTierCode({ required_tier: "tier3", username: "randobot" })).toBe("T3")
    expect(botRequiredTierCode({ required_tier: "unknown", username: "llm_gpt55" })).toBe("T5")
    expect(subscriptionPathForTierCode("T1")).toBe("/subscription")
    expect(subscriptionPathForTierCode("T5")).toBe("/subscription?tier=tier5")
    expect(subscriptionPathForBot({ required_tier: "tier4" })).toBe("/subscription?tier=tier4")
  })

  it("formats_and_sorts_bot_picker_entries", () => {
    expect(botRating({ elo: "bad" })).toBe(1200)
    expect(botPickerName({ display_name: "LLM Haiku (bot)" })).toBe("LLM Haiku")
    expect(botPickerName({ display_name: "   " })).toBe("Unknown bot")
    expect(botPickerName(null)).toBe("Unknown bot")
    expect(botPickerLimitLabel({ llm_backed: false, llm_bot_limit_label: "10 plies" })).toBe("")
    expect(botPickerLimitLabel({ llm_backed: true, llm_bot_limit_label: " No ply limit " })).toBe("")
    expect(botPickerLimitLabel({ llm_backed: true, llm_bot_limit_label: "12 plies" })).toBe("12 plies")
    expect(formatBotPickerLabel({ elo: 1300, display_name: "LLM Haiku (bot)", llm_backed: true, llm_bot_limit_label: "12 plies" })).toBe("1300 - LLM Haiku (12 plies)")

    expect(compareBotPickerBots({ username: "llm_gpt55", elo: 1000 }, { username: "llm_haiku", elo: 2000 })).toBeGreaterThan(0)
    expect(compareBotPickerBots({ username: "randobot", elo: 1000 }, { username: "simpleheuristics", elo: 900 })).toBeLessThan(0)
    expect(compareBotPickerBots({ username: "beta", elo: 1200 }, { username: "alpha", elo: 1200 })).toBeGreaterThan(0)
    expect(compareBotPickerBots({ elo: 1200 }, { elo: 1200 })).toBe(0)
  })

  it("groups_visible_bots_by_catalog_tier", () => {
    expect(groupBotsByTier([
      { username: "simpleheuristics", display_name: "Simple" },
      { username: "llm_gpt55", display_name: "Master" },
      { username: "randobot", display_name: "Random" },
    ])).toEqual([
      { code: "T0", label: "Simple bots", bots: [{ username: "randobot", display_name: "Random" }] },
      { code: "T1", label: "Casual bots", bots: [{ username: "simpleheuristics", display_name: "Simple" }] },
      { code: "T5", label: "Master bots", bots: [{ username: "llm_gpt55", display_name: "Master" }] },
    ])
  })
})
