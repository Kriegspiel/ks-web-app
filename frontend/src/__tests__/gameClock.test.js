import { describe, expect, it } from "vitest"
import { formatClock, projectClock } from "../pages/gameClock"

describe("gameClock", () => {
  it("projects_active_clock_locally_between_polls", () => {
    const projected = projectClock(
      { white_remaining: 601, black_remaining: 598, active_color: "white" },
      { gameState: "active", syncedAtMs: 10_000, nowMs: 11_200 },
    )

    expect(projected).toEqual({
      white_remaining: 599.8,
      black_remaining: 598,
      active_color: "white",
    })
    expect(formatClock(projected.white_remaining)).toBe("9:59")
    expect(formatClock(projected.black_remaining)).toBe("9:58")
  })

  it("does_not_tick_completed_game_clock", () => {
    const projected = projectClock(
      { white_remaining: 601, black_remaining: 598, active_color: "white" },
      { gameState: "completed", syncedAtMs: 10_000, nowMs: 20_000 },
    )

    expect(projected).toEqual({
      white_remaining: 601,
      black_remaining: 598,
      active_color: "white",
    })
  })
})
