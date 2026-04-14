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

export function formatClock(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "--:--"
  }

  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remain = safeSeconds % 60
  return `${minutes}:${String(remain).padStart(2, "0")}`
}
