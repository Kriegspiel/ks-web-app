import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { MemoryRouter, Route, Routes } from "react-router"
import TutorPage from "../pages/Tutor"

const api = vi.hoisted(() => ({
  getTutorWorkspace: vi.fn(), getTutorSession: vi.fn(), createTutorSession: vi.fn(), sendTutorMessage: vi.fn(),
  stopTutorSession: vi.fn(), actTutorExercise: vi.fn(), removeTutorMemory: vi.fn(),
}))
vi.mock("../services/api", () => api)

function session(overrides = {}) { return { session_id: "s1", title: "Learning session", game_code: null, status: "idle", activity: "Your turn.", messages: [], ...overrides } }
function exercise(overrides = {}) { return {
  exercise_id: "e1", session_id: "s1", kind: "play", skill: "Uncertainty", prompt: "Keep two possibilities open.", game_code: "ABC234", ply: 3,
  color: "white", variant: "berkeley_any", board_fen: "8/8/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1", revision: 0,
  hints: [], hints_remaining: 1, hint_count: 0, revealed: false, events: [], due_at: "2026-10-30T00:00:00Z", can_ask_any: true,
  scoresheet: { turns: [{ turn: 1, white: ["Your earlier move", { message: "Pawn capture on e4" }], black: [] }] },
  ...overrides,
} }
function workspace(overrides = {}) { return {
  connection: { connected: true }, sessions: [session()], learning: { notes: {}, goals: {}, practice: [] },
  history: { total: 142, games: [{ game_code: "ABC234", variant: "berkeley_any", completed_moves: 25, color: "white" }] }, ...overrides,
} }
function mount(path = "/tutor") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/tutor" element={<TutorPage />} /><Route path="/game/:gameCode/review/tutor" element={<TutorPage />} /></Routes></MemoryRouter>)
}
async function ready() { await screen.findByRole("heading", { name: "Your Kriegspiel Tutor" }) }
async function boardReady(data = exercise()) {
  api.getTutorWorkspace.mockResolvedValue(workspace({ learning: { notes: {}, goals: {}, practice: [data] } }))
  mount("/tutor?session=s1")
  await screen.findByRole("grid", { name: "Chess board" })
  return data
}
beforeEach(() => {
  vi.resetAllMocks()
  api.getTutorWorkspace.mockResolvedValue(workspace())
  api.getTutorSession.mockResolvedValue(session())
  api.createTutorSession.mockResolvedValue(session())
  api.sendTutorMessage.mockResolvedValue(session())
  api.stopTutorSession.mockResolvedValue(session())
  api.actTutorExercise.mockResolvedValue(exercise({ revision: 1 }))
  api.removeTutorMemory.mockResolvedValue({ removed: true })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

it("loads_subscription_status_without_starting_inference_and_shows_empty_learning_states", async () => {
  api.getTutorWorkspace.mockResolvedValue(workspace({ connection: { connected: false }, sessions: [] }))
  mount()
  expect(screen.getByRole("status")).toHaveTextContent("Loading")
  await ready()
  expect(screen.getByRole("heading", { name: "Connect your ChatGPT plan" })).toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Find a teaching moment" })).toBeDisabled()
  expect(screen.getByText("142 completed games available to your coach.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /ABC234 berkeley_any/ })).toHaveAttribute("href", "/game/ABC234/review/tutor")
  fireEvent.click(screen.getByRole("tab", { name: "Progress & memory" }))
  expect(screen.getByText(/Your coach will propose a focused goal/)).toBeInTheDocument()
  expect(api.sendTutorMessage).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("tab", { name: "Coach & board" }))
})

it("creates_a_personal_session_and_sends_a_message_with_idempotency_key", async () => {
  mount()
  await ready()
  fireEvent.change(screen.getByLabelText("Message your tutor"), { target: { value: "Teach me to reason about checks" } })
  fireEvent.click(screen.getByRole("button", { name: "Send" }))
  await waitFor(() => expect(api.sendTutorMessage).toHaveBeenCalledWith("s1", { request_id: expect.any(String), text: "Teach me to reason about checks" }))
  expect(api.createTutorSession).toHaveBeenCalledWith({ game_code: null })
  await waitFor(() => expect(screen.getByLabelText("Message your tutor")).toHaveValue(""))
  fireEvent.click(screen.getByRole("button", { name: "New session" }))
  fireEvent.submit(screen.getByLabelText("Message your tutor").closest("form"))
  expect(api.sendTutorMessage).toHaveBeenCalledTimes(1)
})

it("opens_game_context_and_requests_an_interactive_lesson", async () => {
  mount("/game/ABC234/review/tutor")
  await ready()
  fireEvent.click(screen.getByRole("button", { name: "Find a teaching moment" }))
  await waitFor(() => expect(api.createTutorSession).toHaveBeenCalledWith({ game_code: "ABC234" }))
  expect(api.sendTutorMessage.mock.calls[0][1].text).toContain("Study my game ABC234")
  expect(screen.getByRole("heading", { name: "Discuss game ABC234" })).toBeInTheDocument()
})

it("starts_a_short_lesson_from_a_conversation_prompt", async () => {
  mount()
  await ready()
  fireEvent.click(screen.getByRole("button", { name: "I have five minutes. What should I practise?" }))
  await waitFor(() => expect(api.sendTutorMessage).toHaveBeenCalledWith("s1", expect.objectContaining({ text: "I have five minutes. What should I practise?" })))
})

it("opens_saved_conversations_and_renders_clickable_evidence_safely", async () => {
  api.getTutorSession.mockResolvedValue(session({ messages: [
    { role: "user", text: "I thought the bishop was pinned." },
    { role: "assistant", text: "Let’s compare ABC234:3 with your explanation. <script>never execute</script>" },
  ] }))
  mount()
  await ready()
  fireEvent.click(screen.getByRole("button", { name: /Learning session/ }))
  await screen.findByText("I thought the bishop was pinned.")
  expect(screen.getByRole("link", { name: "ABC234 · attempt 3" })).toHaveAttribute("href", "/game/ABC234/review")
  expect(screen.getByText(/never execute/)).toBeInTheDocument()
  expect(document.querySelector("script")).toBeNull()
  expect(api.sendTutorMessage).not.toHaveBeenCalled()
})

it("records_board_moves_marks_hints_reset_and_reveal_without_model_calls", async () => {
  await boardReady()
  fireEvent.click(screen.getByRole("button", { name: "Square e2" }))
  fireEvent.click(screen.getByRole("button", { name: "Square e4" }))
  expect(screen.getByLabelText("Move attempt")).toHaveValue("e2e4")
  fireEvent.click(screen.getByLabelText("Mark possible squares"))
  fireEvent.click(screen.getByRole("button", { name: "Square d5" }))
  fireEvent.click(screen.getByRole("button", { name: "Square d5" }))
  fireEvent.contextMenu(screen.getByRole("button", { name: "Square e5" }))
  expect(screen.getByText("Possibilities: e5")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Try move" }))
  await waitFor(() => expect(api.actTutorExercise).toHaveBeenCalledWith("e1", expect.objectContaining({ action: "move", value: "e2e4", marks: ["e5"], revision: 0 })))
  await waitFor(() => expect(screen.getByLabelText("Move attempt")).toHaveValue(""))
  for (const [label, action] of [["Any pawn captures?", "ask_any"], ["Give me a hint", "hint"], ["Retry position", "reset"], ["Reveal full board", "reveal"]]) {
    fireEvent.click(screen.getByRole("button", { name: label }))
    await waitFor(() => expect(api.actTutorExercise).toHaveBeenLastCalledWith("e1", expect.objectContaining({ action })))
    await waitFor(() => expect(screen.getByRole("button", { name: "Retry position" })).not.toBeDisabled())
  }
  expect(api.sendTutorMessage).not.toHaveBeenCalled()
})

it("allows_typed_promotion_attempts_and_discusses_saved_practice", async () => {
  await boardReady()
  fireEvent.change(screen.getByLabelText("Move attempt"), { target: { value: "e7e8q" } })
  fireEvent.click(screen.getByRole("button", { name: "Try move" }))
  await waitFor(() => expect(api.actTutorExercise).toHaveBeenCalledWith("e1", expect.objectContaining({ value: "e7e8q" })))
  await waitFor(() => expect(screen.getByRole("button", { name: "Discuss this practice" })).not.toBeDisabled())
  fireEvent.click(screen.getByRole("button", { name: "Discuss this practice" }))
  await waitFor(() => expect(api.sendTutorMessage).toHaveBeenCalledWith("s1", expect.objectContaining({ text: expect.stringContaining("exercise e1") })))
  expect(api.createTutorSession).not.toHaveBeenCalled()
})

it("shows_revealed_assisted_events_hints_and_referee_feedback", async () => {
  await boardReady(exercise({ revealed: true, hints_remaining: 0, hints: ["Look for an alternative."], hint_count: 1,
    events: [{ action: "move", value: "e2e4", answer: { announcement: "REGULAR_MOVE" }, opponent_answer: { announcement: "REGULAR_MOVE" }, assisted: true },
      { action: "predict", expected: "REGULAR_MOVE", correct: true }, { action: "predict", expected: "ILLEGAL_MOVE", correct: false }] }))
  expect(screen.getByRole("button", { name: "Try move" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Give me a hint" })).toBeDisabled()
  expect(screen.getByRole("button", { name: "Reveal full board" })).toBeDisabled()
  expect(screen.getByText(/Hint 1: Look for an alternative/)).toBeInTheDocument()
  expect(screen.getByText(/Full board revealed/)).toBeInTheDocument()
  expect(screen.getByText(/Compare with your prediction/)).toBeInTheDocument()
})

it("supports_referee_predictions_and_disables_repeat_answers", async () => {
  const data = exercise({ kind: "predict", target: "e2e4", can_ask_any: false })
  api.actTutorExercise.mockResolvedValue({ ...data, events: [{ action: "predict", expected: "REGULAR_MOVE", correct: true }] })
  await boardReady(data)
  fireEvent.click(screen.getByRole("button", { name: "regular move" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "regular move" })).toBeDisabled())
  expect(api.actTutorExercise).toHaveBeenCalledWith("e1", expect.objectContaining({ action: "predict", value: "REGULAR_MOVE" }))
})

it("saves_an_explanation_with_marked_possibilities", async () => {
  await boardReady(exercise({ kind: "explain", can_ask_any: false }))
  fireEvent.change(screen.getByLabelText("Your reasoning"), { target: { value: "Two explanations fit the referee answers." } })
  fireEvent.click(screen.getByRole("button", { name: "Save explanation & marks" }))
  await waitFor(() => expect(api.actTutorExercise).toHaveBeenCalledWith("e1", expect.objectContaining({ action: "explain", value: "Two explanations fit the referee answers." })))
})

it("shows_evidence_based_goals_correctable_memory_and_saved_practice", async () => {
  const evidence = [{ game_code: "ABC234", ply: 3 }]
  api.getTutorWorkspace.mockResolvedValue(workspace({ learning: {
    goals: { g: { key: "g", title: "Maintain alternatives", status: "active", rationale: "A recurring decision.", success_criterion: "Explain alternatives without prompting.", next_activity: "Try another game.", evidence } },
    notes: { n: { key: "n", kind: "hypothesis", skill: "Uncertainty", confidence: "low", text: "Needs more evidence.", evidence } },
    practice: [exercise({ hint_count: 1, revealed: true, events: [{ action: "move" }, { action: "hint" }] })],
  } }))
  mount()
  await ready()
  fireEvent.click(screen.getByRole("tab", { name: "Progress & memory" }))
  expect(screen.getByText("Maintain alternatives")).toBeInTheDocument()
  expect(screen.getByText("hypothesis · low confidence")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "Forget this note" }))
  await waitFor(() => expect(api.removeTutorMemory).toHaveBeenCalledWith({ kind: "note", key: "n" }))
  await waitFor(() => expect(screen.getByRole("button", { name: "Remove goal" })).not.toBeDisabled())
  fireEvent.click(screen.getByRole("button", { name: "Remove goal" }))
  await waitFor(() => expect(api.removeTutorMemory).toHaveBeenCalledWith({ kind: "goal", key: "g" }))
  fireEvent.click(screen.getByRole("button", { name: "Open practice" }))
  await screen.findByRole("grid", { name: "Chess board" })
})

it("polls_only_running_turns_refreshes_learning_and_allows_cancellation", async () => {
  vi.useFakeTimers()
  api.getTutorSession.mockResolvedValue(session({ status: "running", activity: "Studying your game…" }))
  mount("/tutor?session=s1")
  await act(async () => {})
  expect(screen.getByRole("button", { name: "Stop thinking" })).toBeInTheDocument()
  api.getTutorSession.mockResolvedValue(session({ messages: [{ role: "assistant", text: "Ready to practise." }] }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  expect(screen.getByText("Ready to practise.")).toBeInTheDocument()
  expect(api.getTutorWorkspace).toHaveBeenCalledTimes(2)
  cleanup()
  api.getTutorSession.mockResolvedValue(session({ status: "running" }))
  mount("/tutor?session=s1")
  await act(async () => {})
  fireEvent.click(screen.getByRole("button", { name: "Stop thinking" }))
  await act(async () => {})
  expect(api.stopTutorSession).toHaveBeenCalledWith("s1")
})

it("keeps_visible_errors_for_loading_sending_practice_and_memory_failures", async () => {
  api.getTutorWorkspace.mockRejectedValueOnce(new Error("Connection unavailable"))
  mount()
  await screen.findByRole("alert")
  expect(screen.getByRole("alert")).toHaveTextContent("Connection unavailable")
  cleanup()
  api.getTutorSession.mockRejectedValueOnce(new Error("Session unavailable"))
  mount("/tutor?session=s1")
  await screen.findByText("Session unavailable")
  cleanup()
  api.sendTutorMessage.mockRejectedValueOnce(new Error("Usage limit reached"))
  mount()
  await ready()
  fireEvent.click(screen.getByRole("button", { name: "Find a teaching moment" }))
  await screen.findByText("Usage limit reached")
  cleanup()
  api.actTutorExercise.mockRejectedValueOnce(new Error("Exercise changed"))
  await boardReady()
  fireEvent.click(screen.getByRole("button", { name: "Give me a hint" }))
  await screen.findByText("Exercise changed")
})

it("ignores_workspace_and_session_responses_after_unmount", async () => {
  let resolve
  api.getTutorWorkspace.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  const view = mount()
  view.unmount()
  await act(async () => resolve(workspace()))
  let reject
  api.getTutorWorkspace.mockReturnValueOnce(new Promise((_done, fail) => { reject = fail }))
  const other = mount()
  other.unmount()
  await act(async () => reject(new Error("late")))
  let rejectSession
  api.getTutorSession.mockReturnValueOnce(new Promise((_done, fail) => { rejectSession = fail }))
  const saved = mount("/tutor?session=s1")
  await ready()
  saved.unmount()
  await act(async () => rejectSession(new Error("late session")))
  let resolveSession
  api.getTutorSession.mockReturnValueOnce(new Promise((done) => { resolveSession = done }))
  const lateSession = mount("/tutor?session=s1")
  await ready()
  lateSession.unmount()
  await act(async () => resolveSession(session()))
})

it("handles_poll_errors_and_ignores_late_poll_results", async () => {
  vi.useFakeTimers()
  api.getTutorSession.mockResolvedValue(session({ status: "running" }))
  let view = mount("/tutor?session=s1")
  await act(async () => {})
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  expect(screen.getByRole("button", { name: "Stop thinking" })).toBeInTheDocument()
  api.getTutorSession.mockRejectedValueOnce(new Error("Polling failed"))
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  expect(screen.getByRole("alert")).toHaveTextContent("Polling failed")
  let resolve
  api.getTutorSession.mockReturnValueOnce(new Promise((done) => { resolve = done }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  view.unmount()
  await act(async () => resolve(session()))

  api.getTutorSession.mockResolvedValue(session({ status: "running" }))
  view = mount("/tutor?session=s1")
  await act(async () => {})
  let reject
  api.getTutorSession.mockReturnValueOnce(new Promise((_done, fail) => { reject = fail }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  view.unmount()
  await act(async () => reject(new Error("Late poll failure")))

  api.getTutorSession.mockResolvedValue(session({ status: "running" }))
  view = mount("/tutor?session=s1")
  await act(async () => {})
  api.getTutorSession.mockResolvedValue(session())
  let resolveWorkspace
  api.getTutorWorkspace.mockReturnValueOnce(new Promise((done) => { resolveWorkspace = done }))
  await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
  view.unmount()
  await act(async () => resolveWorkspace(workspace()))
})

it("respects_variants_without_Any_and_shows_unrevealed_practice_history", async () => {
  await boardReady(exercise({ can_ask_any: false }))
  expect(screen.queryByRole("button", { name: "Any pawn captures?" })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("tab", { name: "Progress & memory" }))
  expect(screen.getByText(/0 hints · 0 recorded attempts/)).toBeInTheDocument()
})
