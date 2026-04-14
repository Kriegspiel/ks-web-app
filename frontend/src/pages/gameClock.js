export function projectClock(clock, { gameState = "active", syncedAtMs, nowMs } = {}) {
  if (!clock || typeof clock !== "object") {
    return null
  }

  let whiteRemaining = Number(clock.white_remaining)
  let blackRemaining = Number(clock.black_remaining)
  const activeColor = clock.active_color === "white" || clock.active_color === "black" ? clock.active_color : null

  if (gameState === "active" && activeColor && Number.isFinite(syncedAtMs) && Number.isFinite(nowMs)) {
    const elapsedSeconds = Math.max(0, (nowMs - syncedAtMs) / 1000)
    if (activeColor === "white" && Number.isFinite(whiteRemaining)) {
      whiteRemaining = Math.max(0, whiteRemaining - elapsedSeconds)
    }
    if (activeColor === "black" && Number.isFinite(blackRemaining)) {
      blackRemaining = Math.max(0, blackRemaining - elapsedSeconds)
    }
  }

  return {
    white_remaining: whiteRemaining,
    black_remaining: blackRemaining,
    active_color: activeColor,
  }
}

export function reconcileClockSnapshot(previousState, nextState, { previousSyncedAtMs, nextSyncedAtMs } = {}) {
  const nextClock = nextState?.clock
  if (!nextClock || typeof nextClock !== "object") {
    return nextClock ?? null
  }

  const previousClock = previousState?.clock
  const nextActiveColor = nextClock.active_color === "white" || nextClock.active_color === "black" ? nextClock.active_color : null
  const sameActiveStretch =
    previousState?.state === "active" &&
    nextState?.state === "active" &&
    previousState?.move_number === nextState?.move_number &&
    previousState?.turn === nextState?.turn &&
    previousClock?.active_color === nextActiveColor &&
    nextActiveColor

  if (!sameActiveStretch) {
    return nextClock
  }

  const projectedPreviousClock = projectClock(previousClock, {
    gameState: previousState?.state,
    syncedAtMs: previousSyncedAtMs,
    nowMs: nextSyncedAtMs,
  })

  if (!projectedPreviousClock) {
    return nextClock
  }

  if (nextActiveColor === "white") {
    return {
      ...nextClock,
      white_remaining: Math.min(
        Number(nextClock.white_remaining),
        Number(projectedPreviousClock.white_remaining),
      ),
    }
  }

  return {
    ...nextClock,
    black_remaining: Math.min(
      Number(nextClock.black_remaining),
      Number(projectedPreviousClock.black_remaining),
    ),
  }
}

export function formatClock(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--:--"
  }

  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remain = safeSeconds % 60
  return `${minutes}:${String(remain).padStart(2, "0")}`
}
