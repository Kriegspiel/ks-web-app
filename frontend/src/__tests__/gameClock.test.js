import { describe, expect, it } from "vitest"
import { formatClock, projectClock, reconcileClockSnapshot } from "../pages/gameClock"

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

  it("keeps_active_clock_monotonic_within_the_same_turn", () => {
    const reconciled = reconcileClockSnapshot(
      {
        state: "active",
        move_number: 1,
        turn: "white",
        clock: { white_remaining: 601, black_remaining: 598, active_color: "white" },
      },
      {
        state: "active",
        move_number: 1,
        turn: "white",
        clock: { white_remaining: 600.8, black_remaining: 598, active_color: "white" },
      },
      { previousSyncedAtMs: 10_000, nextSyncedAtMs: 10_500 },
    )

    expect(reconciled).toEqual({
      white_remaining: 600.5,
      black_remaining: 598,
      active_color: "white",
    })
  })

  it("accepts_clock_jump_when_turn_changes", () => {
    const reconciled = reconcileClockSnapshot(
      {
        state: "active",
        move_number: 1,
        turn: "white",
        clock: { white_remaining: 601, black_remaining: 598, active_color: "white" },
      },
      {
        state: "active",
        move_number: 2,
        turn: "black",
        clock: { white_remaining: 611, black_remaining: 598, active_color: "black" },
      },
      { previousSyncedAtMs: 10_000, nextSyncedAtMs: 10_500 },
    )

    expect(reconciled).toEqual({
      white_remaining: 611,
      black_remaining: 598,
      active_color: "black",
    })
  })

  it("handles_invalid_clock_inputs_and_black_active_projection", () => {
    expect(projectClock(null)).toBe(null)

    expect(projectClock(
      { white_remaining: 601, black_remaining: 598, active_color: "black" },
      { gameState: "active", syncedAtMs: 10_000, nowMs: 12_000 },
    )).toEqual({
      white_remaining: 601,
      black_remaining: 596,
      active_color: "black",
    })

    expect(projectClock(
      { white_remaining: 601, black_remaining: 598, active_color: "green" },
      { gameState: "active", syncedAtMs: 10_000, nowMs: 12_000 },
    )).toEqual({
      white_remaining: 601,
      black_remaining: 598,
      active_color: null,
    })
  })

  it("returns_the_next_clock_when_snapshots_cannot_be_reconciled", () => {
    expect(reconcileClockSnapshot(
      { state: "waiting", clock: { white_remaining: 30, black_remaining: 30, active_color: "white" } },
      { state: "active", clock: { white_remaining: 29, black_remaining: 30, active_color: "white" } },
      { previousSyncedAtMs: 10_000, nextSyncedAtMs: 11_000 },
    )).toEqual({
      white_remaining: 29,
      black_remaining: 30,
      active_color: "white",
    })

    expect(reconcileClockSnapshot(
      { state: "active", clock: { white_remaining: 30, black_remaining: 30, active_color: "white" } },
      { state: "active", clock: null },
      { previousSyncedAtMs: 10_000, nextSyncedAtMs: 11_000 },
    )).toBe(null)
  })

  it("returns_the_next_clock_when_the_active_color_is_unknown", () => {
    expect(reconcileClockSnapshot(
      {
        state: "active",
        move_number: 3,
        turn: "white",
        clock: { white_remaining: 30, black_remaining: 30, active_color: "white" },
      },
      {
        state: "active",
        move_number: 3,
        turn: "white",
        clock: { white_remaining: 29, black_remaining: 30, active_color: "green" },
      },
      { previousSyncedAtMs: 10_000, nextSyncedAtMs: 11_000 },
    )).toEqual({
      white_remaining: 29,
      black_remaining: 30,
      active_color: "green",
    })
  })

  it("keeps_black_clock_monotonic_within_the_same_turn", () => {
    const reconciled = reconcileClockSnapshot(
      {
        state: "active",
        move_number: 7,
        turn: "black",
        clock: { white_remaining: 250, black_remaining: 199, active_color: "black" },
      },
      {
        state: "active",
        move_number: 7,
        turn: "black",
        clock: { white_remaining: 250, black_remaining: 198.8, active_color: "black" },
      },
      { previousSyncedAtMs: 10_000, nextSyncedAtMs: 10_500 },
    )

    expect(reconciled).toEqual({
      white_remaining: 250,
      black_remaining: 198.5,
      active_color: "black",
    })
  })

  it("formats_invalid_and_negative_clock_values_safely", () => {
    expect(formatClock(Number.NaN)).toBe("--:--")
    expect(formatClock("59")).toBe("--:--")
    expect(formatClock(-1)).toBe("0:00")
  })
})
