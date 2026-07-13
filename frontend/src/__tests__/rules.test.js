import { describe, expect, it } from "vitest"
import { formatRuleVariant } from "../utils/rules"

describe("rules utilities", () => {
  it("formats_known_rules_and_falls_back_for_unknown_values", () => {
    expect(formatRuleVariant(" berkeley_any ")).toBe("Berkeley + Any")
    expect(formatRuleVariant("")).toBe("—")
    expect(formatRuleVariant(null)).toBe("—")
    expect(formatRuleVariant("mystery")).toBe("—")
  })
})
