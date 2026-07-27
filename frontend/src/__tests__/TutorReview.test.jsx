import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router"
import TutorReviewPage from "../pages/TutorReview"

const mockApi = vi.hoisted(() => ({
  generateTutorGameAnalysis: vi.fn(),
  getTutorGame: vi.fn(),
  submitTutorFeedback: vi.fn(),
}))

vi.mock("../services/api", () => mockApi)

function profile(overrides = {}) {
  return {
    reviewed_games: 0,
    ready: false,
    games_until_ready: 5,
    summary: "Tutor is learning from your reviewed games.",
    strengths: [],
    focus_areas: [],
    updated_at: null,
    ...overrides,
  }
}

function usage(overrides = {}) {
  return {
    month: "2026-07",
    limit_usd: 5,
    spent_usd: 0,
    reserved_usd: 0,
    remaining_usd: 5,
    ...overrides,
  }
}

function review(overrides = {}) {
  return {
    overview: "You gathered useful information before committing to moves.",
    result_context: "The result supports this pattern without proving every choice was optimal.",
    key_moments: [
      {
        turn: 1,
        title: "Structured pawn probe",
        observation: "You asked Any? before testing a pawn capture.",
        why_it_matters: "The sequence reduced uncertainty.",
        suggestion: "Keep the probe order consistent.",
        evidence: ["T1A1", "T1A2"],
        confidence: "high",
      },
      {
        turn: 2,
        title: "Useful second signal",
        observation: "Your second attempt used the first answer.",
        why_it_matters: "The attempts formed a sequence.",
        suggestion: "Name the next probe before submitting.",
        evidence: ["T2A1"],
        confidence: "medium",
      },
      {
        turn: 3,
        title: "Tentative pattern",
        observation: "One move may indicate a developing habit.",
        why_it_matters: "It is worth watching, not concluding.",
        suggestion: "Collect another example.",
        evidence: ["T3A1"],
        confidence: "low",
      },
    ],
    strengths: [
      {
        skill: "Probe discipline",
        evidence: "You used a public question before move attempts.",
        action: "Repeat the sequence when Any? is available.",
      },
    ],
    improvements: [
      {
        skill: "Attempt efficiency",
        evidence: "The first completed move required multiple attempts.",
        action: "Order candidates before submitting.",
      },
    ],
    next_drill: {
      title: "Three-candidate scan",
      instructions: "Name three plausible moves before the first attempt.",
      success_criterion: "Complete five turns without an unplanned second attempt.",
    },
    profile_update: {
      summary: "Probe discipline is emerging.",
      strengths: ["Probe discipline"],
      focus_areas: [],
    },
    ...overrides,
  }
}

function analysis(overrides = {}) {
  return {
    game_code: "ABC234",
    generated_at: "2026-07-27T12:00:00Z",
    cached: false,
    model: "gpt-5.6-terra",
    analysis_version: "tutor-evidence-v1",
    prompt_version: "tutor-private-beta-v1",
    review: review(),
    feedback: null,
    ...overrides,
  }
}

function tutorData(overrides = {}) {
  return {
    game_code: "ABC234",
    eligible: true,
    eligibility_reason: null,
    analysis: null,
    profile: profile(),
    usage: usage(),
    ...overrides,
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function renderTutor(path = "/game/ABC234/review/tutor") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/game/:gameCode/review/tutor" element={<TutorReviewPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockApi.generateTutorGameAnalysis.mockReset()
  mockApi.getTutorGame.mockReset()
  mockApi.submitTutorFeedback.mockReset()
})

afterEach(() => {
  cleanup()
})

describe("TutorReviewPage", () => {
  it("loads_an_eligible_private_review_without_spending_until_fil_asks", async () => {
    const request = deferred()
    mockApi.getTutorGame.mockReturnValue(request.promise)

    renderTutor()

    expect(screen.getByText("Loading Tutor memory…")).toBeInTheDocument()
    expect(screen.getByText(/not replay FENs or opponent move squares/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to replay" })).toHaveAttribute("href", "/game/ABC234/review")

    await act(async () => {
      request.resolve(tutorData({ usage: usage({ reserved_usd: 0.04, remaining_usd: 4.96 }) }))
      await request.promise
    })

    expect(await screen.findByRole("button", { name: "Analyze this game" })).toBeEnabled()
    const memoryCard = screen.getByRole("heading", { name: "Tutor memory" }).closest("section")
    expect(memoryCard.querySelector(".tutor-profile-card__count strong")).toHaveTextContent("0")
    expect(memoryCard.querySelector(".tutor-profile-card__count span")).toHaveTextContent("reviews")
    expect(screen.getByLabelText("0 of 5 reviews toward progress insights")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Usage this month" }).closest("section")).toHaveTextContent("$0.04 is reserved for an analysis in progress.")
    expect(mockApi.generateTutorGameAnalysis).not.toHaveBeenCalled()
  })

  it("generates_a_structured_review_updates_ready_memory_and_shows_exact_cost", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData())
    const generation = deferred()
    mockApi.generateTutorGameAnalysis.mockReturnValue(generation.promise)
    const readyProfile = profile({
      reviewed_games: 5,
      ready: true,
      games_until_ready: 0,
      summary: "Your probing is now more deliberate across games.",
      strengths: ["Probe discipline"],
      focus_areas: [
        {
          skill: "Attempt efficiency",
          reason: "Candidate ordering still varies.",
          next_action: "Use a three-candidate scan.",
        },
      ],
    })

    renderTutor()
    fireEvent.click(await screen.findByRole("button", { name: "Analyze this game" }))
    expect(screen.getByRole("button", { name: "Tutor is thinking…" })).toBeDisabled()

    await act(async () => {
      generation.resolve(tutorData({
        analysis: analysis(),
        profile: readyProfile,
        usage: usage({ spent_usd: 0.01, remaining_usd: 4.99 }),
      }))
      await generation.promise
    })

    expect(await screen.findByRole("heading", { name: "What this game says" })).toBeInTheDocument()
    expect(screen.getByText("New analysis")).toBeInTheDocument()
    expect(screen.getByText("High confidence")).toBeInTheDocument()
    expect(screen.getByText("Medium confidence")).toBeInTheDocument()
    expect(screen.getByText("Exploratory")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Keep doing" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Work on next" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Three-candidate scan" })).toBeInTheDocument()
    expect(screen.getByText("Your probing is now more deliberate across games.")).toBeInTheDocument()
    expect(screen.getByText("Next: Use a three-candidate scan.")).toBeInTheDocument()
    expect(screen.getByText("$0.01")).toBeInTheDocument()
    expect(screen.getByText("$4.99 remains in the private-beta budget.")).toBeInTheDocument()
  })

  it("renders_cached_sparse_analysis_and_existing_feedback_without_claiming_false_certainty", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData({
      analysis: analysis({
        cached: true,
        generated_at: "invalid",
        review: review({ key_moments: [], strengths: [], improvements: [] }),
        feedback: { rating: "incorrect", comment: "This inference was too strong.", updated_at: "2026-07-27T12:00:00Z" },
      }),
      profile: profile({ reviewed_games: 5, ready: true, games_until_ready: 0, strengths: [], focus_areas: [] }),
    }))

    renderTutor()

    expect(await screen.findByText("Cached · no new model cost")).toBeInTheDocument()
    expect(screen.getByText("Saved review")).toBeInTheDocument()
    expect(screen.getByText("This game did not produce a reliable key moment.")).toBeInTheDocument()
    expect(screen.getAllByText("No strong signal in this game.")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Incorrect" })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByDisplayValue("This inference was too strong.")).toBeInTheDocument()
    expect(screen.getByText("Feedback saved.")).toBeInTheDocument()
  })

  it("explains_short_games_and_a_zero_budget_without_offering_generation", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData({
      eligible: false,
      eligibility_reason: "Tutor needs at least 4 completed turns for a useful review.",
      profile: profile({ reviewed_games: 4, games_until_ready: 1 }),
      usage: usage({ limit_usd: 0, remaining_usd: 0 }),
    }))

    renderTutor()

    expect(await screen.findByText("Tutor needs at least 4 completed turns for a useful review.")).toBeInTheDocument()
    expect(screen.getByText("1 more useful review before Tutor treats recurring signals as progress trends.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Analyze this game" })).not.toBeInTheDocument()
    expect(screen.getByRole("progressbar", { name: "Tutor monthly budget used" })).toHaveAttribute("aria-valuemax", "0")
  })

  it("disables_generation_when_the_budget_has_no_remaining_room", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData({
      profile: profile({ reviewed_games: 1, games_until_ready: 4 }),
      usage: usage({ spent_usd: 6, remaining_usd: 0 }),
    }))

    renderTutor()

    expect(await screen.findByRole("button", { name: "Analyze this game" })).toBeDisabled()
    expect(screen.getByRole("heading", { name: "Tutor memory" }).closest("section").querySelector(".tutor-profile-card__count span")).toHaveTextContent("review")
  })

  it("shows_load_and_generation_errors_with_safe_fallback_messages", async () => {
    mockApi.getTutorGame.mockRejectedValueOnce({ message: "Tutor review is private." })
    renderTutor()
    expect(await screen.findByRole("alert")).toHaveTextContent("Tutor review is private.")
    cleanup()

    mockApi.getTutorGame.mockRejectedValueOnce({})
    renderTutor()
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load Tutor review right now.")
    cleanup()

    mockApi.getTutorGame.mockResolvedValueOnce(tutorData())
    mockApi.generateTutorGameAnalysis.mockRejectedValueOnce({})
    renderTutor()
    fireEvent.click(await screen.findByRole("button", { name: "Analyze this game" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to generate Tutor review right now.")
    expect(screen.getByRole("button", { name: "Analyze this game" })).toBeEnabled()
  })

  it("does_not_update_state_after_unmount_for_resolved_or_rejected_loads", async () => {
    const resolved = deferred()
    mockApi.getTutorGame.mockReturnValueOnce(resolved.promise)
    const first = renderTutor()
    first.unmount()
    await act(async () => {
      resolved.resolve(tutorData())
      await resolved.promise
    })

    const rejected = deferred()
    mockApi.getTutorGame.mockReturnValueOnce(rejected.promise)
    const second = renderTutor()
    second.unmount()
    await act(async () => {
      rejected.reject(new Error("late"))
      try {
        await rejected.promise
      } catch {
        // The component intentionally ignores late failures after unmount.
      }
    })
  })

  it("submits_detailed_feedback_and_updates_the_saved_state", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData({ analysis: analysis() }))
    mockApi.submitTutorFeedback.mockResolvedValue({
      rating: "helpful",
      comment: "The drill is concrete.",
      updated_at: "2026-07-27T12:05:00Z",
    })

    renderTutor()
    await screen.findByRole("heading", { name: "Was this coaching useful?" })
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }))
    fireEvent.change(screen.getByLabelText(/What should Tutor improve/i), { target: { value: "  The drill is concrete.  " } })
    fireEvent.click(screen.getByRole("button", { name: "Save feedback" }))

    await waitFor(() => {
      expect(mockApi.submitTutorFeedback).toHaveBeenCalledWith("ABC234", {
        rating: "helpful",
        comment: "The drill is concrete.",
      })
    })
    expect(await screen.findByText("Feedback saved. It will help tune the beta.")).toBeInTheDocument()
  })

  it("guards_empty_and_duplicate_feedback_submissions_and_sends_blank_comments_as_null", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData({ analysis: analysis() }))
    const saving = deferred()
    mockApi.submitTutorFeedback.mockReturnValue(saving.promise)
    renderTutor()
    const heading = await screen.findByRole("heading", { name: "Was this coaching useful?" })
    const form = heading.closest("section").querySelector("form")

    fireEvent.submit(form)
    expect(mockApi.submitTutorFeedback).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Not useful" }))
    fireEvent.change(screen.getByLabelText(/What should Tutor improve/i), { target: { value: "   " } })
    fireEvent.submit(form)
    await waitFor(() => expect(mockApi.submitTutorFeedback).toHaveBeenCalledTimes(1))
    fireEvent.submit(form)
    expect(mockApi.submitTutorFeedback).toHaveBeenCalledTimes(1)

    await act(async () => {
      saving.resolve({ rating: "not_helpful", comment: null, updated_at: "2026-07-27T12:06:00Z" })
      await saving.promise
    })
    expect(mockApi.submitTutorFeedback).toHaveBeenCalledWith("ABC234", { rating: "not_helpful", comment: null })
  })

  it("keeps_the_analysis_visible_when_feedback_saving_fails", async () => {
    mockApi.getTutorGame.mockResolvedValue(tutorData({ analysis: analysis() }))
    mockApi.submitTutorFeedback.mockRejectedValue({})
    renderTutor()
    await screen.findByRole("heading", { name: "Was this coaching useful?" })
    fireEvent.click(screen.getByRole("button", { name: "Incorrect" }))
    fireEvent.click(screen.getByRole("button", { name: "Save feedback" }))

    expect(await screen.findByText("Unable to save feedback right now.")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What this game says" })).toBeInTheDocument()
  })
})
