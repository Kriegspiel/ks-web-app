const DEFAULT_GAIN = 0.045

function scheduleTone(ctx, start, frequency, duration, { type = "sine", gain = DEFAULT_GAIN } = {}) {
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gainNode.gain.setValueAtTime(0.0001, start)
  gainNode.gain.exponentialRampToValueAtTime(gain, start + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.03)
  return start + duration
}

function scheduleCategory(ctx, category, start) {
  switch (category) {
    case "illegal":
      scheduleTone(ctx, start, 180, 0.08, { type: "square", gain: 0.04 })
      return scheduleTone(ctx, start + 0.1, 150, 0.1, { type: "square", gain: 0.035 })
    case "move":
      return scheduleTone(ctx, start, 620, 0.07, { type: "triangle", gain: 0.03 })
    case "capture":
      scheduleTone(ctx, start, 520, 0.08, { type: "triangle", gain: 0.04 })
      return scheduleTone(ctx, start + 0.09, 340, 0.12, { type: "triangle", gain: 0.05 })
    case "check":
      scheduleTone(ctx, start, 700, 0.07, { type: "triangle", gain: 0.04 })
      return scheduleTone(ctx, start + 0.08, 880, 0.12, { type: "triangle", gain: 0.045 })
    case "any_yes":
      scheduleTone(ctx, start, 440, 0.08, { type: "sine", gain: 0.03 })
      return scheduleTone(ctx, start + 0.1, 660, 0.12, { type: "sine", gain: 0.035 })
    case "any_no":
      return scheduleTone(ctx, start, 260, 0.12, { type: "sine", gain: 0.03 })
    case "game_over":
      scheduleTone(ctx, start, 440, 0.08, { type: "triangle", gain: 0.03 })
      scheduleTone(ctx, start + 0.1, 554, 0.08, { type: "triangle", gain: 0.03 })
      return scheduleTone(ctx, start + 0.2, 659, 0.18, { type: "triangle", gain: 0.04 })
    default:
      return start
  }
}

export function announcementSoundCategories(messages = []) {
  const categories = []
  for (const message of messages) {
    if (typeof message !== "string") {
      continue
    }
    const normalized = message.trim().toLowerCase()
    if (!normalized) {
      continue
    }
    if (normalized.startsWith("capture done")) {
      categories.push("capture")
      continue
    }
    if (normalized.startsWith("illegal move")) {
      categories.push("illegal")
      continue
    }
    if (normalized.startsWith("move complete")) {
      categories.push("move")
      continue
    }
    if (normalized.includes("has pawn captures")) {
      categories.push("any_yes")
      continue
    }
    if (normalized.includes("no pawn captures")) {
      categories.push("any_no")
      continue
    }
    if (
      normalized.includes("check on rank") ||
      normalized.includes("check on file") ||
      normalized.includes("check on long diagonal") ||
      normalized.includes("check on short diagonal") ||
      normalized.includes("check by knight") ||
      normalized.includes("double check")
    ) {
      categories.push("check")
      continue
    }
    if (
      normalized.includes("checkmate") ||
      normalized.includes("draw by") ||
      normalized.includes("wins by timeout") ||
      normalized.includes("wins by resignation")
    ) {
      categories.push("game_over")
    }
  }

  return categories
}

export function createGameSoundPlayer() {
  let audioContext = null
  let queuedUntil = 0

  function getAudioContext() {
    if (audioContext) {
      return audioContext
    }
    if (typeof window === "undefined") {
      return null
    }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) {
      return null
    }
    audioContext = new AudioContextClass()
    return audioContext
  }

  async function prime() {
    const ctx = getAudioContext()
    if (!ctx || ctx.state !== "suspended") {
      return
    }
    try {
      await ctx.resume()
    } catch {
      // Ignore browser autoplay errors; a later user gesture can unlock audio.
    }
  }

  function playCategories(categories = []) {
    if (!Array.isArray(categories) || categories.length === 0) {
      return
    }
    const ctx = getAudioContext()
    if (!ctx || ctx.state === "suspended") {
      return
    }

    let cursor = Math.max(ctx.currentTime + 0.02, queuedUntil)
    categories.forEach((category) => {
      cursor = scheduleCategory(ctx, category, cursor) + 0.05
    })
    queuedUntil = cursor
  }

  return { prime, playCategories }
}
