import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import TierBadge from "../components/TierBadge"

afterEach(() => cleanup())

describe("TierBadge", () => {
  it("applies_known_tier_classes_and_keeps_custom_classes", () => {
    render(<TierBadge code=" T3 " className="custom-tier" aria-label="tier badge" />)

    expect(screen.getByLabelText("tier badge")).toHaveClass("tier-badge", "tier-badge--t3", "custom-tier")
  })

  it("omits_modifier_classes_for_unknown_codes", () => {
    render(<TierBadge code="mystery" aria-label="unknown tier" />)

    expect(screen.getByLabelText("unknown tier")).toHaveClass("tier-badge")
    expect(screen.getByLabelText("unknown tier").className).toBe("tier-badge")
  })

  it("omits_modifier_classes_for_empty_codes", () => {
    render(<TierBadge code={null} aria-label="empty tier" />)

    expect(screen.getByLabelText("empty tier")).toHaveClass("tier-badge")
    expect(screen.getByLabelText("empty tier").className).toBe("tier-badge")
  })
})
