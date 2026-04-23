import { afterEach, describe, expect, it, vi } from "vitest"
import { announcementSoundCategories, createGameSoundPlayer } from "../gameSounds"

const originalAudioContext = window.AudioContext
const originalWebkitAudioContext = window.webkitAudioContext

function restoreAudioContext() {
  if (originalAudioContext === undefined) {
    delete window.AudioContext
  } else {
    window.AudioContext = originalAudioContext
  }

  if (originalWebkitAudioContext === undefined) {
    delete window.webkitAudioContext
  } else {
    window.webkitAudioContext = originalWebkitAudioContext
  }
}

function createAudioContextInstance({ state = "running", resumeError = null } = {}) {
  const oscillators = []
  const gains = []
  const ctx = {
    state,
    currentTime: 5,
    destination: { node: "destination" },
    createOscillator: vi.fn(() => {
      const oscillator = {
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      }
      oscillators.push(oscillator)
      return oscillator
    }),
    createGain: vi.fn(() => {
      const gainNode = {
        gain: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
      }
      gains.push(gainNode)
      return gainNode
    }),
    resume: resumeError
      ? vi.fn().mockRejectedValue(resumeError)
      : vi.fn().mockResolvedValue(undefined),
  }

  return { ctx, oscillators, gains }
}

function installAudioContext(options = {}, { useWebkit = false } = {}) {
  const instances = []

  class FakeAudioContext {
    constructor() {
      const { ctx, oscillators, gains } = createAudioContextInstance(options)
      Object.assign(this, ctx)
      this._oscillators = oscillators
      this._gains = gains
      instances.push(this)
    }
  }

  if (useWebkit) {
    delete window.AudioContext
    window.webkitAudioContext = FakeAudioContext
  } else {
    window.AudioContext = FakeAudioContext
    delete window.webkitAudioContext
  }

  return instances
}

afterEach(() => {
  restoreAudioContext()
})

describe("announcementSoundCategories", () => {
  it("maps_referee_messages_to_sound_categories", () => {
    expect(announcementSoundCategories([
      null,
      "",
      " capture done",
      "Capture at e4",
      "Pawn captured at d5",
      "illegal move: knight jump",
      "Nonsense",
      "move complete",
      "white has pawn captures on file c",
      "Black has pawn capture",
      "2 pawn tries",
      "No pawn captures remain",
      "check on rank",
      "double check",
      "checkmate",
      "wins by resignation",
      "draw by stalemate",
    ])).toEqual([
      "capture",
      "capture",
      "capture",
      "illegal",
      "illegal",
      "move",
      "any_yes",
      "any_yes",
      "any_yes",
      "any_no",
      "check",
      "check",
      "game_over",
      "game_over",
      "game_over",
    ])
  })
})

describe("createGameSoundPlayer", () => {
  it("does_nothing_when_the_browser_has_no_audio_context", async () => {
    delete window.AudioContext
    delete window.webkitAudioContext

    const player = createGameSoundPlayer()

    await expect(player.prime()).resolves.toBeUndefined()
    expect(() => player.playCategories(["move"])).not.toThrow()
  })

  it("resumes_suspended_audio_context_and_ignores_autoplay_resume_errors", async () => {
    let instances = installAudioContext({ state: "suspended" })
    let player = createGameSoundPlayer()

    await expect(player.prime()).resolves.toBeUndefined()
    expect(instances[0].resume).toHaveBeenCalledTimes(1)
    player.playCategories(["move"])
    expect(instances[0].createOscillator).not.toHaveBeenCalled()

    restoreAudioContext()

    instances = installAudioContext({ state: "suspended", resumeError: new Error("blocked") })
    player = createGameSoundPlayer()
    await expect(player.prime()).resolves.toBeUndefined()
    expect(instances[0].resume).toHaveBeenCalledTimes(1)
  })

  it("schedules_tones_for_each_supported_category_and_reuses_one_context_instance", () => {
    const instances = installAudioContext({}, { useWebkit: true })
    const player = createGameSoundPlayer()

    player.playCategories(["illegal", "move", "capture", "check", "any_yes", "any_no", "game_over", "unknown"])
    player.playCategories(["move"])

    expect(instances).toHaveLength(1)
    expect(instances[0].createOscillator).toHaveBeenCalledTimes(14)
    expect(instances[0].createGain).toHaveBeenCalledTimes(14)
    expect(instances[0]._oscillators[0].frequency.setValueAtTime).toHaveBeenCalled()
    expect(instances[0]._gains[0].gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(2)
    expect(instances[0]._oscillators.every((oscillator) => oscillator.connect.mock.calls.length === 1)).toBe(true)
    expect(instances[0]._oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(true)
    expect(instances[0]._oscillators.every((oscillator) => oscillator.stop.mock.calls.length === 1)).toBe(true)
  })
})
